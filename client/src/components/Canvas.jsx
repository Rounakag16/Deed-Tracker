import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import DeedCard from "./DeedCard";
import { blankDeed } from "./DeedForm";
import { computeLayers, computePositions } from "../layout";

let tempIdCounter = 0;
const nextTempId = () => `draft_${++tempIdCounter}`;

function deedLabel(deed) {
  const num = deed.deedInfo?.deedNumber || "(no deed no.)";
  const buyer = deed.purchasers?.[0]?.name || "";
  return buyer ? `${num} - ${buyer}` : num;
}

const NODE_W = 320;
const NODE_H_ESTIMATE = 110; // only used for layout spacing; actual dot
// positions are measured from the real DOM so expanded cards don't break it
const COL_GAP = 60;
const ROW_GAP = 90;
const PADDING = 50;

export default function Canvas({ workspace, onView }) {
  const [savedDeeds, setSavedDeeds] = useState([]);
  const [savedRelationships, setSavedRelationships] = useState([]);
  const [draftDeeds, setDraftDeeds] = useState([]); // { _tempId, ...deedFields }
  const [pendingEdges, setPendingEdges] = useState([]); // { sourceKey, targetKey, areaTransferred, note }
  const [edgeDraft, setEdgeDraft] = useState(null); // { sourceKey, targetKey } awaiting area/note confirm
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState(null);
  const [isCardDragging, setIsCardDragging] = useState(false);
  const [liveDragPos, setLiveDragPos] = useState(null); // { key, x, y } while a card is being repositioned
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const draggingSourceRef = useRef(null);
  const cardDragRef = useRef(null);
  const contentRef = useRef(null);
  const wrapperRefs = useRef(new Map());
  const topDotRefs = useRef(new Map());
  const bottomDotRefs = useRef(new Map());
  const [anchors, setAnchors] = useState(new Map());

  const load = () => {
    api.listDeeds(workspace._id).then(setSavedDeeds);
    api.listRelationships(workspace._id).then(setSavedRelationships);
  };
  useEffect(load, [workspace._id]);

  const keyFor = (deed) => (deed._id ? deed._id : deed._tempId);
  const allCards = useMemo(() => [...savedDeeds, ...draftDeeds], [savedDeeds, draftDeeds]);
  const allKeys = useMemo(() => allCards.map(keyFor), [allCards]);
  const labelForKey = (key) => {
    const d = allCards.find((c) => keyFor(c) === key);
    return d ? deedLabel(d) : key;
  };

  // Same deed number appearing on more than one deed in this workspace is
  // usually a typo (or a legitimate re-use across offices) - flag it, don't
  // block on it.
  const duplicateDeedNumbers = useMemo(() => {
    const byNumber = new Map();
    allCards.forEach((d) => {
      const num = d.deedInfo?.deedNumber?.trim();
      if (!num) return;
      if (!byNumber.has(num)) byNumber.set(num, []);
      byNumber.get(num).push(d);
    });
    return [...byNumber.entries()].filter(([, group]) => group.length > 1);
  }, [allCards]);

  // All edges that should influence layout + rendering: saved relationships
  // plus links the user has wired up but not saved yet.
  const graphEdges = useMemo(
    () => [
      ...savedRelationships.map((r) => ({
        sourceKey: String(r.sourceDeedId),
        targetKey: String(r.targetDeedId),
        areaTransferred: r.areaTransferred,
        _id: r._id,
        saved: true,
      })),
      ...pendingEdges.map((e, pendingIndex) => ({ ...e, saved: false, pendingIndex })),
    ],
    [savedRelationships, pendingEdges]
  );

  const { positions, width, height } = useMemo(() => {
    const layerById = computeLayers(allKeys, graphEdges);
    return computePositions(allKeys, layerById, {
      nodeW: NODE_W,
      nodeH: NODE_H_ESTIMATE,
      colGap: COL_GAP,
      rowGap: ROW_GAP,
      padding: PADDING,
      direction: "vertical",
    });
  }, [allKeys, graphEdges]);

  // Measure real dot positions from the DOM so edges connect to wherever a
  // card's top/bottom actually is, regardless of expanded/collapsed height.
  const recomputeAnchors = useCallback(() => {
    if (!contentRef.current) return;
    const contentRect = contentRef.current.getBoundingClientRect();
    const next = new Map();
    allKeys.forEach((key) => {
      const topEl = topDotRefs.current.get(key);
      const bottomEl = bottomDotRefs.current.get(key);
      if (!topEl || !bottomEl) return;
      const tr = topEl.getBoundingClientRect();
      const br = bottomEl.getBoundingClientRect();
      next.set(key, {
        top: { x: tr.left + tr.width / 2 - contentRect.left, y: tr.top + tr.height / 2 - contentRect.top },
        bottom: { x: br.left + br.width / 2 - contentRect.left, y: br.top + br.height / 2 - contentRect.top },
      });
    });
    setAnchors(next);
  }, [allKeys]);

  useLayoutEffect(recomputeAnchors, [recomputeAnchors, positions, liveDragPos, savedDeeds, draftDeeds]);

  useEffect(() => {
    const observer = new ResizeObserver(recomputeAnchors);
    wrapperRefs.current.forEach((el) => el && observer.observe(el));
    window.addEventListener("resize", recomputeAnchors);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recomputeAnchors);
    };
  }, [allKeys, recomputeAnchors]);

  // Drag-to-wire: mousedown on a card's bottom (output) dot starts a drag;
  // dropping on another card's top (input) dot queues a link for confirmation.
  const startDrag = (sourceKey) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    draggingSourceRef.current = sourceKey;
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e) => {
      if (!contentRef.current) return;
      const rect = contentRef.current.getBoundingClientRect();
      setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    const handleUp = (e) => {
      let targetKey = null;
      for (const [key, el] of topDotRefs.current.entries()) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const pad = 10;
        if (
          e.clientX >= r.left - pad &&
          e.clientX <= r.right + pad &&
          e.clientY >= r.top - pad &&
          e.clientY <= r.bottom + pad
        ) {
          targetKey = key;
          break;
        }
      }
      const sourceKey = draggingSourceRef.current;
      draggingSourceRef.current = null;
      setIsDragging(false);
      setDragPos(null);
      if (targetKey && sourceKey && targetKey !== sourceKey) {
        setEdgeDraft({ sourceKey, targetKey, areaTransferred: "", note: "" });
      }
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging]);

  // A manually-placed deed uses its stored position; otherwise fall back to
  // the auto-arranged layered position. While actively dragging a card, its
  // live (uncommitted) position wins so the move feels immediate.
  const resolvedPos = (key, deed) => {
    if (liveDragPos && liveDragPos.key === key) return { x: liveDragPos.x, y: liveDragPos.y };
    if (deed.position) return deed.position;
    return positions.get(key);
  };

  const commitCardPosition = (key, pos) => {
    const draft = draftDeeds.find((d) => d._tempId === key);
    if (draft) {
      updateDraft(key, { ...draft, position: pos });
      return;
    }
    api.updateDeed(workspace._id, key, { position: pos }).then(load);
  };

  // Drag-to-move: mousedown anywhere on a card except its buttons/inputs/dots
  // starts repositioning it. Dots already stopPropagation() so they don't
  // trigger this.
  const startCardDrag = (key, currentPos) => (e) => {
    if (e.target.closest("button, input, textarea, select")) return;
    e.preventDefault();
    cardDragRef.current = {
      key,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: currentPos.x,
      startY: currentPos.y,
    };
    setIsCardDragging(true);
  };

  useEffect(() => {
    if (!isCardDragging) return;
    const handleMove = (e) => {
      const d = cardDragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startMouseX;
      const dy = e.clientY - d.startMouseY;
      if (Math.hypot(dx, dy) < 3) return; // ignore tiny jitter from a plain click
      setLiveDragPos({ key: d.key, x: Math.max(0, d.startX + dx), y: Math.max(0, d.startY + dy) });
    };
    const handleUp = () => {
      cardDragRef.current = null;
      setIsCardDragging(false);
      setLiveDragPos((current) => {
        if (current) commitCardPosition(current.key, { x: current.x, y: current.y });
        return null;
      });
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isCardDragging]);

  const resetLayout = async () => {
    if (!confirm("Snap every deed back to the auto-arranged layout?")) return;
    setDraftDeeds((prev) => prev.map((d) => ({ ...d, position: null })));
    const placed = savedDeeds.filter((d) => d.position);
    await Promise.all(placed.map((d) => api.updateDeed(workspace._id, d._id, { position: null })));
    load();
  };

  const addDraftDeed = () => {
    setDraftDeeds((prev) => [...prev, { _tempId: nextTempId(), ...blankDeed() }]);
  };

  const updateDraft = (tempId, next) => {
    setDraftDeeds((prev) => prev.map((d) => (d._tempId === tempId ? { ...next, _tempId: tempId } : d)));
  };

  const removeDraft = (tempId) => {
    setDraftDeeds((prev) => prev.filter((d) => d._tempId !== tempId));
    setPendingEdges((prev) => prev.filter((e) => e.sourceKey !== tempId && e.targetKey !== tempId));
  };

  const deleteSavedDeed = async (id) => {
    if (!confirm("Delete this deed and every relationship touching it?")) return;
    await api.deleteDeed(workspace._id, id);
    load();
  };

  const confirmEdgeDraft = () => {
    setPendingEdges((prev) => [...prev, edgeDraft]);
    setEdgeDraft(null);
  };

  const removePendingEdge = (i) => setPendingEdges((prev) => prev.filter((_, idx) => idx !== i));

  const deleteSavedRelationship = async (id) => {
    if (!confirm("Remove this link?")) return;
    await api.deleteRelationship(workspace._id, id);
    load();
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError("");
    try {
      const idMap = {};
      if (draftDeeds.length > 0) {
        const toCreate = draftDeeds.map(({ _tempId, ...fields }) => fields);
        const created = await api.createDeeds(workspace._id, toCreate);
        draftDeeds.forEach((d, i) => {
          idMap[d._tempId] = created[i]._id;
        });
      }
      if (pendingEdges.length > 0) {
        const resolved = pendingEdges.map((e) => ({
          sourceDeedId: idMap[e.sourceKey] || e.sourceKey,
          targetDeedId: idMap[e.targetKey] || e.targetKey,
          areaTransferred: e.areaTransferred,
          note: e.note,
        }));
        await api.createRelationships(workspace._id, resolved);
      }
      setDraftDeeds([]);
      setPendingEdges([]);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const hasUnsaved = draftDeeds.length > 0 || pendingEdges.length > 0;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-xl font-bold">{workspace.name}</h2>
        <div className="flex-1" />
        <button onClick={addDraftDeed} className="bg-slate-900 text-white px-3 py-1.5 rounded text-sm">
          + Add Deed
        </button>
        <button onClick={onView} className="border border-slate-900 px-3 py-1.5 rounded text-sm">
          View
        </button>
        <button onClick={resetLayout} className="border border-slate-400 text-slate-600 px-3 py-1.5 rounded text-sm">
          Reset Layout
        </button>
        <a
          href={api.exportWorkspaceUrl(workspace._id)}
          className="border border-green-700 text-green-700 px-3 py-1.5 rounded text-sm"
        >
          Export to Excel
        </a>
        {hasUnsaved && (
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-green-600 text-white px-3 py-1.5 rounded text-sm"
          >
            {saving ? "Saving…" : `Save (${draftDeeds.length} deed(s), ${pendingEdges.length} link(s))`}
          </button>
        )}
      </div>

      <p className="text-sm text-slate-500 mb-4">
        Drag a card to reposition it, or drag from the dot at the bottom of a deed to the dot at
        the top of another to mark that it derives from it. New deeds and links only take effect
        once you click Save; a moved card's position saves immediately.
      </p>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {duplicateDeedNumbers.length > 0 && (
        <div className="border border-amber-400 bg-amber-50 text-amber-800 rounded p-3 mb-4 text-sm">
          <p className="font-medium mb-1">Duplicate deed number(s) in this workspace:</p>
          <ul className="list-disc list-inside">
            {duplicateDeedNumbers.map(([num, group]) => (
              <li key={num}>
                "{num}" used by {group.length} deeds
                {group.some((d) => !d._id) ? " (including an unsaved one)" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {edgeDraft && (
        <div className="border border-blue-400 bg-blue-50 rounded p-3 mb-4 text-sm">
          <p className="mb-2">
            <strong>{labelForKey(edgeDraft.targetKey)}</strong> derives from{" "}
            <strong>{labelForKey(edgeDraft.sourceKey)}</strong>
          </p>
          <div className="flex gap-2 mb-2">
            <input
              className="flex-1 border rounded px-2 py-1"
              placeholder="Area/share transferred (optional)"
              value={edgeDraft.areaTransferred}
              onChange={(e) => setEdgeDraft({ ...edgeDraft, areaTransferred: e.target.value })}
            />
            <input
              className="flex-1 border rounded px-2 py-1"
              placeholder="Note (optional)"
              value={edgeDraft.note}
              onChange={(e) => setEdgeDraft({ ...edgeDraft, note: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={confirmEdgeDraft} className="bg-blue-600 text-white px-3 py-1 rounded">
              Add this link
            </button>
            <button onClick={() => setEdgeDraft(null)} className="px-3 py-1">
              Cancel
            </button>
          </div>
        </div>
      )}

      {allCards.length === 0 ? (
        <p className="text-slate-500">No deeds yet. Click "Add Deed" to start.</p>
      ) : (
        <div className="border rounded bg-slate-50 overflow-auto" style={{ maxHeight: "75vh" }}>
          <div
            ref={contentRef}
            style={{ position: "relative", width: Math.max(width, 700), height: Math.max(height, 300) }}
          >
            <svg
              width={Math.max(width, 700)}
              height={Math.max(height, 300)}
              style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
            >
              <defs>
                <marker id="arrowhead-edit" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#64748b" />
                </marker>
              </defs>

              {graphEdges.map((e, i) => {
                const a = anchors.get(e.sourceKey);
                const b = anchors.get(e.targetKey);
                if (!a || !b) return null;
                const x1 = a.bottom.x,
                  y1 = a.bottom.y;
                const x2 = b.top.x,
                  y2 = b.top.y;
                const midY = (y1 + y2) / 2;
                return (
                  <g key={e._id || `pending-${i}`}>
                    <path
                      d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                      fill="none"
                      stroke={e.saved ? "#64748b" : "#f59e0b"}
                      strokeWidth="2"
                      strokeDasharray={e.saved ? undefined : "5,4"}
                      markerEnd="url(#arrowhead-edit)"
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onClick={() =>
                        e.saved
                          ? deleteSavedRelationship(e._id)
                          : removePendingEdge(e.pendingIndex)
                      }
                    />
                    {e.areaTransferred && (
                      <text
                        x={(x1 + x2) / 2}
                        y={midY - 4}
                        fontSize="10"
                        fill="#475569"
                        textAnchor="middle"
                        style={{ pointerEvents: "none" }}
                      >
                        {e.areaTransferred}
                      </text>
                    )}
                  </g>
                );
              })}

              {isDragging &&
                dragPos &&
                (() => {
                  const a = anchors.get(draggingSourceRef.current);
                  if (!a) return null;
                  const midY = (a.bottom.y + dragPos.y) / 2;
                  return (
                    <path
                      d={`M ${a.bottom.x} ${a.bottom.y} C ${a.bottom.x} ${midY}, ${dragPos.x} ${midY}, ${dragPos.x} ${dragPos.y}`}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />
                  );
                })()}
            </svg>

            {allCards.map((deed) => {
              const key = keyFor(deed);
              const pos = resolvedPos(key, deed);
              const isDraft = !deed._id;
              if (!pos) return null;
              const isBeingDragged = liveDragPos?.key === key;
              return (
                <div
                  key={key}
                  ref={(el) => {
                    if (el) wrapperRefs.current.set(key, el);
                    else wrapperRefs.current.delete(key);
                  }}
                  onMouseDown={startCardDrag(key, pos)}
                  style={{
                    position: "absolute",
                    left: pos.x,
                    top: pos.y,
                    width: NODE_W,
                    cursor: isBeingDragged ? "grabbing" : "grab",
                    zIndex: isBeingDragged ? 20 : 1,
                  }}
                >
                  <div
                    ref={(el) => {
                      if (el) topDotRefs.current.set(key, el);
                      else topDotRefs.current.delete(key);
                    }}
                    title="Derives from (drop a link here)"
                    className="w-4 h-4 rounded-full bg-slate-400 border-2 border-white shadow mx-auto"
                    style={{ position: "absolute", top: -8, left: NODE_W / 2 - 8, zIndex: 5 }}
                  />

                  <DeedCard
                    deed={deed}
                    isDraft={isDraft}
                    onChange={isDraft ? (next) => updateDraft(deed._tempId, next) : undefined}
                    onSave={
                      !isDraft
                        ? async (next) => {
                            const { _id, __v, createdAt, updatedAt, workspaceId, ...fields } = next;
                            await api.updateDeed(workspace._id, deed._id, fields);
                            load();
                          }
                        : undefined
                    }
                    onDelete={() => (isDraft ? removeDraft(deed._tempId) : deleteSavedDeed(deed._id))}
                  />

                  <div
                    ref={(el) => {
                      if (el) bottomDotRefs.current.set(key, el);
                      else bottomDotRefs.current.delete(key);
                    }}
                    onMouseDown={startDrag(key)}
                    title="Drag to link this deed to one derived from it"
                    className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow mx-auto cursor-grab active:cursor-grabbing"
                    style={{ position: "absolute", bottom: -8, left: NODE_W / 2 - 8, zIndex: 5 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
