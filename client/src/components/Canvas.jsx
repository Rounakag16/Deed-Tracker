import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import DeedCard from "./DeedCard";
import DeedSidebar from "./DeedSidebar";
import { blankDeed } from "./DeedForm";
import { computeLayers, computePositions } from "../layout";

let tempIdCounter = 0;
const nextTempId = () => `draft_${++tempIdCounter}`;

function deedLabel(deed) {
  const num = deed.deedInfo?.deedNumber || "(no deed no.)";
  const buyer = deed.purchasers?.[0]?.name || "";
  return buyer ? `${num} - ${buyer}` : num;
}

function heightsEqual(a, b) {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [key, v] of a) {
    if (b.get(key) !== v) return false;
  }
  return true;
}

function anchorsEqual(a, b) {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [key, v] of a) {
    const w = b.get(key);
    if (!w) return false;
    if (v.top.x !== w.top.x || v.top.y !== w.top.y || v.bottom.x !== w.bottom.x || v.bottom.y !== w.bottom.y) {
      return false;
    }
  }
  return true;
}

// Must match DeedCard.jsx's card width exactly - see the comment there.
const NODE_W = 400;
const NODE_H_ESTIMATE = 110; // only used for layout spacing; actual dot
// positions are measured from the real DOM so expanded cards don't break it
const COL_GAP = 60;
const ROW_GAP = 90;
const PADDING = 50;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

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
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null); // key of the card shown in the sidebar
  const [sidebarDirty, setSidebarDirty] = useState(false); // mirrors DeedSidebar's own dirty state

  const draggingSourceRef = useRef(null);
  const cardDragRef = useRef(null);
  const panRef = useRef(null);
  const contentRef = useRef(null);
  const scrollRef = useRef(null);
  const wrapperRefs = useRef(new Map());
  const topDotRefs = useRef(new Map());
  const bottomDotRefs = useRef(new Map());
  const [anchors, setAnchors] = useState(new Map());
  const [cardHeights, setCardHeights] = useState(new Map());

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
  // The deed shown in the sidebar. If it was deleted or a draft got saved
  // (and so changed key), this just quietly resolves to nothing and the
  // sidebar closes on its own - no separate cleanup needed.
  const selectedDeed = selectedKey ? allCards.find((c) => keyFor(c) === selectedKey) : null;

  // Switching the sidebar to a different (or no) card would silently throw
  // away any unsaved edit sitting in it - confirm first, same as every
  // other state-losing action in this file (Delete, Reset Layout).
  const trySelect = (key) => {
    if (sidebarDirty && selectedKey && selectedKey !== key) {
      if (!confirm("Discard the unsaved changes on the currently selected deed?")) return;
    }
    setSidebarDirty(false);
    setSelectedKey(key);
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

  const layerById = useMemo(() => computeLayers(allKeys, graphEdges), [allKeys, graphEdges]);

  const { positions, width: layoutWidth } = useMemo(() => {
    return computePositions(allKeys, layerById, {
      nodeW: NODE_W,
      nodeH: NODE_H_ESTIMATE,
      colGap: COL_GAP,
      rowGap: ROW_GAP,
      padding: PADDING,
      direction: "vertical",
    });
  }, [allKeys, layerById]);

  // Row spacing above is based on a fixed height estimate, so an expanded
  // (mid-edit) card - which is much taller - can visually overlap the row
  // below it (see PROJECT_CONTEXT.md Known Issues). Fix: measure each
  // auto-positioned card's real rendered height (cardHeights, populated by
  // the ResizeObserver below) and grow that row's spacing to fit the
  // tallest card actually in it, pushing every row after it down. Manually
  // positioned/mid-drag cards are excluded - they don't live in a "row".
  const { autoPositions, rowLayoutHeight } = useMemo(() => {
    const heightsByLayer = new Map();
    allCards.forEach((deed) => {
      const key = keyFor(deed);
      if (deed.position) return;
      if (liveDragPos?.key === key) return;
      const l = layerById.get(key) ?? 0;
      const measured = cardHeights.get(key) || NODE_H_ESTIMATE;
      heightsByLayer.set(l, Math.max(heightsByLayer.get(l) || NODE_H_ESTIMATE, measured));
    });

    const layers = [...new Set(allKeys.map((k) => layerById.get(k) ?? 0))].sort((a, b) => a - b);
    const rowOffset = new Map();
    let cumulative = PADDING;
    layers.forEach((l) => {
      rowOffset.set(l, cumulative);
      cumulative += (heightsByLayer.get(l) || NODE_H_ESTIMATE) + ROW_GAP;
    });

    const next = new Map();
    positions.forEach((pos, key) => {
      const l = layerById.get(key) ?? 0;
      next.set(key, { x: pos.x, y: rowOffset.get(l) ?? pos.y });
    });

    return { autoPositions: next, rowLayoutHeight: layers.length ? cumulative - ROW_GAP + PADDING : PADDING * 2 };
  }, [allCards, allKeys, layerById, cardHeights, positions, liveDragPos]);

  // The auto-layout algorithm above only knows about auto-arranged
  // positions - it has no idea a card has been manually dragged somewhere
  // else. Without accounting for that, a card dragged near/past the
  // layout's assumed width/height would overflow the canvas's stated
  // content box, which (combined with the anchor-measurement effect below)
  // could send the browser into a resize/measure feedback loop. Grow the
  // content box to always cover every card's actual resolved position.
  const { width, height } = useMemo(() => {
    let maxX = layoutWidth;
    let maxY = rowLayoutHeight;
    allCards.forEach((deed) => {
      const pos = deed.position;
      if (!pos) return;
      maxX = Math.max(maxX, pos.x + NODE_W + PADDING);
      maxY = Math.max(maxY, pos.y + NODE_H_ESTIMATE + PADDING);
    });
    // Also grow to cover the card currently being dragged, in real time -
    // otherwise the boundary is only corrected after the drag ends.
    if (liveDragPos) {
      maxX = Math.max(maxX, liveDragPos.x + NODE_W + PADDING);
      maxY = Math.max(maxY, liveDragPos.y + NODE_H_ESTIMATE + PADDING);
    }
    return { width: maxX, height: maxY };
  }, [allCards, layoutWidth, rowLayoutHeight, liveDragPos]);

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
    // Guard against a render/measure feedback loop: only actually update
    // state (triggering a re-render) if something really moved. Without
    // this, any effect/observer that fires on every render (directly or
    // indirectly) can cascade into React's "Maximum update depth exceeded".
    setAnchors((prev) => (anchorsEqual(prev, next) ? prev : next));
  }, [allKeys]);

  // Measures each card wrapper's real rendered height so row spacing can
  // grow to fit an expanded card (see the autoPositions/rowLayoutHeight
  // memo above). Same equality-guard pattern as recomputeAnchors, for the
  // same reason: an unguarded setState inside a ResizeObserver callback
  // that itself feeds back into layout can cascade into a render loop.
  const recomputeCardHeights = useCallback(() => {
    const next = new Map();
    wrapperRefs.current.forEach((el, key) => {
      if (!el) return;
      next.set(key, el.getBoundingClientRect().height);
    });
    setCardHeights((prev) => (heightsEqual(prev, next) ? prev : next));
  }, []);

  // Two separate effects on purpose, not one: recomputeAnchors reacts to
  // autoPositions changing (so wires follow rows that grew/shrank), but
  // recomputeCardHeights must NOT be in that same effect, because
  // autoPositions is *derived from* cardHeights (via the memo above) - if
  // this effect's deps included autoPositions, every cardHeights update
  // would re-run this same effect, which measures heights again and can
  // set cardHeights again, which changes autoPositions again... a real
  // "Maximum update depth exceeded" loop, not just a spurious one the
  // equality guards catch (confirmed live - see PROJECT_CONTEXT.md Known
  // Issues). recomputeCardHeights only needs to run when the set of
  // rendered cards changes (mount, add/remove) - the ResizeObserver below
  // already independently catches a genuine size change to an existing
  // card via the browser's own native resize signal, with no React
  // dependency-cycle risk.
  useLayoutEffect(() => {
    recomputeAnchors();
  }, [recomputeAnchors, autoPositions, liveDragPos, savedDeeds, draftDeeds]);

  useLayoutEffect(() => {
    recomputeCardHeights();
  }, [recomputeCardHeights, allKeys]);

  useEffect(() => {
    const handleResize = () => {
      recomputeAnchors();
      recomputeCardHeights();
    };
    const observer = new ResizeObserver(handleResize);
    wrapperRefs.current.forEach((el) => el && observer.observe(el));
    window.addEventListener("resize", handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [allKeys, recomputeAnchors, recomputeCardHeights]);

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
    return autoPositions.get(key);
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
  // trigger this. The same gesture doubles as "click to select": if the
  // mouse never moves past the jitter threshold before mouseup, it's
  // treated as a click and opens the sidebar for that card instead of
  // committing a (zero-distance) position change - see handleUp below.
  const startCardDrag = (key, currentPos) => (e) => {
    if (e.target.closest("button, input, textarea, select")) return;
    e.preventDefault();
    // Stop this mousedown from also reaching the scroll container's
    // startPan handler below - otherwise dragging a card would also try to
    // pan the canvas at the same time.
    e.stopPropagation();
    cardDragRef.current = {
      key,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: currentPos.x,
      startY: currentPos.y,
      moved: false,
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
      d.moved = true;
      setLiveDragPos({ key: d.key, x: Math.max(0, d.startX + dx), y: Math.max(0, d.startY + dy) });
    };
    const handleUp = () => {
      const d = cardDragRef.current;
      cardDragRef.current = null;
      setIsCardDragging(false);
      if (d && !d.moved) {
        trySelect(d.key); // plain click - open the sidebar, don't touch position
      }
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

  // Pan: mousedown on empty canvas background (not a card, dot, edge, or
  // form control) drags the scroll container's scrollLeft/scrollTop, so you
  // don't have to hunt for the browser's own scrollbars on a large graph.
  const startPan = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("path, button, input, textarea, select, [data-card-wrapper]")) return;
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: scrollRef.current.scrollLeft,
      scrollTop: scrollRef.current.scrollTop,
    };
    setIsPanning(true);
  };

  useEffect(() => {
    if (!isPanning) return;
    const handleMove = (e) => {
      const p = panRef.current;
      if (!p || !scrollRef.current) return;
      scrollRef.current.scrollLeft = p.scrollLeft - (e.clientX - p.startX);
      scrollRef.current.scrollTop = p.scrollTop - (e.clientY - p.startY);
    };
    const handleUp = () => {
      panRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isPanning]);

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
  const zoomReset = () => setZoom(1);

  const resetLayout = async () => {
    if (!confirm("Snap every deed back to the auto-arranged layout?")) return;
    setDraftDeeds((prev) => prev.map((d) => ({ ...d, position: null })));
    const placed = savedDeeds.filter((d) => d.position);
    await Promise.all(placed.map((d) => api.updateDeed(workspace._id, d._id, { position: null })));
    load();
  };

  const addDraftDeed = () => {
    if (sidebarDirty && selectedKey) {
      if (!confirm("Discard the unsaved changes on the currently selected deed?")) return;
    }
    const tempId = nextTempId();
    setDraftDeeds((prev) => [...prev, { _tempId: tempId, ...blankDeed() }]);
    setSidebarDirty(false);
    setSelectedKey(tempId); // open the sidebar straight away, same as the old inline-expand-on-add did
  };

  const updateDraft = (tempId, next) => {
    setDraftDeeds((prev) => prev.map((d) => (d._tempId === tempId ? { ...next, _tempId: tempId } : d)));
  };

  const removeDraft = (tempId) => {
    setDraftDeeds((prev) => prev.filter((d) => d._tempId !== tempId));
    setPendingEdges((prev) => prev.filter((e) => e.sourceKey !== tempId && e.targetKey !== tempId));
    if (selectedKey === tempId) {
      setSelectedKey(null);
      setSidebarDirty(false);
    }
  };

  // Returns whether the deed was actually deleted, so callers (the
  // sidebar) know whether to close themselves - confirm() can be canceled.
  const deleteSavedDeed = async (id) => {
    if (!confirm("Delete this deed and every relationship touching it?")) return false;
    await api.deleteDeed(workspace._id, id);
    load();
    if (selectedKey === id) {
      setSelectedKey(null);
      setSidebarDirty(false);
    }
    return true;
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
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-white shrink-0">
        <h2 className="text-xl font-bold">{workspace.name}</h2>
        <div className="flex-1" />
        <div className="flex items-center border rounded overflow-hidden text-sm">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="px-2 py-1.5 hover:bg-slate-100 disabled:opacity-40"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={zoomReset}
            className="px-2 py-1.5 border-x hover:bg-slate-100 w-14"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="px-2 py-1.5 hover:bg-slate-100 disabled:opacity-40"
            title="Zoom in"
          >
            +
          </button>
        </div>
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

      {(error || duplicateDeedNumbers.length > 0 || edgeDraft) && (
        <div className="px-4 py-3 border-b bg-white shrink-0 space-y-3">
          {error && <p className="text-red-600 text-sm">{error}</p>}

          {duplicateDeedNumbers.length > 0 && (
            <div className="border border-amber-400 bg-amber-50 text-amber-800 rounded p-3 text-sm">
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
            <div className="border border-blue-400 bg-blue-50 rounded p-3 text-sm">
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
        </div>
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {allCards.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            No deeds yet. Click "Add Deed" to start.
          </div>
        ) : (
          <div
            ref={scrollRef}
            onMouseDown={startPan}
            className="flex-1 overflow-auto bg-slate-50"
            style={{ cursor: isPanning ? "grabbing" : "grab" }}
          >
            {/* Outer sizing div matches the *scaled* content dimensions so the
                scroll container's scrollbars/scroll range are correct at any
                zoom level; the inner div is the actual unscaled content,
                transformed down/up to fit. */}
            <div
              style={{
                width: Math.max(width, 900) * zoom,
                height: Math.max(height, 400) * zoom,
              }}
            >
              <div
                ref={contentRef}
                style={{
                  position: "relative",
                  width: Math.max(width, 900),
                  height: Math.max(height, 400),
                  transform: `scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
              >
                <svg
                  width={Math.max(width, 900)}
                  height={Math.max(height, 400)}
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
                const isSelected = selectedKey === key;
                return (
                  <div
                    key={key}
                    data-card-wrapper="true"
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
                      cursor: isBeingDragged ? "grabbing" : "pointer",
                      zIndex: isBeingDragged ? 20 : isSelected ? 10 : 1,
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

                    <DeedCard deed={deed} isDraft={isDraft} isSelected={isSelected} />

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
          </div>
        )}

        {selectedDeed &&
          (() => {
            const isDraft = !selectedDeed._id;
            return (
              <DeedSidebar
                key={selectedKey}
                deed={selectedDeed}
                isDraft={isDraft}
                onChange={isDraft ? (next) => updateDraft(selectedDeed._tempId, next) : undefined}
                onSave={
                  !isDraft
                    ? async (next) => {
                        const { _id, __v, createdAt, updatedAt, workspaceId, ...fields } = next;
                        await api.updateDeed(workspace._id, selectedDeed._id, fields);
                        load();
                      }
                    : undefined
                }
                onDelete={async () => {
                  if (isDraft) removeDraft(selectedDeed._tempId);
                  else await deleteSavedDeed(selectedDeed._id);
                }}
                onDirtyChange={setSidebarDirty}
                onClose={() => trySelect(null)}
              />
            );
          })()}
      </div>
    </div>
  );
}
