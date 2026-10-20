import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import DeedCard from "./DeedCard";
import DeedSidebar from "./DeedSidebar";
import { blankDeed } from "./DeedForm";
import { computeLayers, computePositions } from "../layout";
import { customConfirm } from "../utils/confirm";
import { deedLabel } from "../utils/deedLabel";
import { printDeed, printWorkspace } from "../utils/print";

let tempIdCounter = 0;
const nextTempId = () => `draft_${++tempIdCounter}`;

// SVG stroke/fill colors, hardcoded to match tailwind.config.js's dark
// theme palette exactly (Tailwind's stroke-color utilities don't cover
// dynamically-chosen colors here, so these mirror the config values
// directly - same pattern the pre-redesign code used with raw hex).
const WIRE_SAVED = "#a9723a"; // brass-soft
const WIRE_PENDING = "#c98a3b"; // brass
const WIRE_LIVE_DRAG = "#4f9a8c"; // verdigris
const WIRE_LABEL = "#8d94a3"; // ink-muted


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
  const [selectedEdge, setSelectedEdge] = useState(null); // edge being inspected/edited via click
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [quickFindQuery, setQuickFindQuery] = useState("");

  const draggingSourceRef = useRef(null);
  const cardDragRef = useRef(null);
  const panRef = useRef(null);
  const contentRef = useRef(null);
  const scrollRef = useRef(null);
  const targetScrollRef = useRef(null);
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

  // Client-side quick-find: filter cards matching the query without an API call
  const quickFindMatches = useMemo(() => {
    if (!quickFindOpen || !quickFindQuery.trim()) return null;
    const q = quickFindQuery.toLowerCase();
    return new Set(
      allCards
        .filter((deed) => {
          const num = deed.deedInfo?.deedNumber?.toLowerCase() || "";
          const buyers = (deed.purchasers || []).map((p) => p.name?.toLowerCase() || "").join(" ");
          const sellers = (deed.sellers || []).map((s) => s.name?.toLowerCase() || "").join(" ");
          const moujas = (deed.landParcels || []).map((lp) => lp.mouja?.toLowerCase() || "").join(" ");
          const title = deed.title?.toLowerCase() || "";
          return num.includes(q) || buyers.includes(q) || sellers.includes(q) || moujas.includes(q) || title.includes(q);
        })
        .map(keyFor)
    );
  }, [quickFindOpen, quickFindQuery, allCards]);

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
  const trySelect = async (key) => {
    if (sidebarDirty && selectedKey && selectedKey !== key) {
      if (!(await customConfirm("Discard the unsaved changes on the currently selected deed?"))) return;
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

  // Connection counts for each card (parent/child edge counts)
  const connectionCounts = useMemo(() => {
    const counts = new Map();
    allKeys.forEach((key) => counts.set(key, { parents: 0, children: 0 }));
    graphEdges.forEach((e) => {
      const tc = counts.get(e.targetKey);
      const sc = counts.get(e.sourceKey);
      if (tc) tc.parents++;
      if (sc) sc.children++;
    });
    return counts;
  }, [allKeys, graphEdges]);

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
    // getBoundingClientRect() is measured post-transform (after contentRef's
    // `scale(zoom)`), but the SVG the anchors feed into lives inside that
    // same scaled container and gets scaled again when it renders - so
    // divide the measured offsets back out by zoom to land in the
    // unscaled coordinate space the SVG actually expects. Without this,
    // wires drift out of position at any zoom other than 100%.
    //
    // Also round to the nearest half-pixel. getBoundingClientRect() on an
    // element inside a CSS transform can return slightly different
    // floating-point values across otherwise-identical measurements
    // (subpixel rounding in the transform matrix, more pronounced under
    // non-100% OS display scaling). anchorsEqual below does an exact `!==`
    // compare, so two measurements of a position that hasn't actually
    // moved can still register as "different" - which defeats the
    // equality guard entirely and reintroduces the exact
    // "Maximum update depth exceeded" loop that guard exists to prevent,
    // via the ResizeObserver below re-firing on the resulting re-render.
    const round = (n) => Math.round(n * 2) / 2;
    allKeys.forEach((key) => {
      const topEl = topDotRefs.current.get(key);
      const bottomEl = bottomDotRefs.current.get(key);
      if (!topEl || !bottomEl) return;
      const tr = topEl.getBoundingClientRect();
      const br = bottomEl.getBoundingClientRect();
      next.set(key, {
        top: {
          x: round((tr.left + tr.width / 2 - contentRect.left) / zoom),
          y: round((tr.top + tr.height / 2 - contentRect.top) / zoom),
        },
        bottom: {
          x: round((br.left + br.width / 2 - contentRect.left) / zoom),
          y: round((br.top + br.height / 2 - contentRect.top) / zoom),
        },
      });
    });
    // Guard against a render/measure feedback loop: only actually update
    // state (triggering a re-render) if something really moved. Without
    // this, any effect/observer that fires on every render (directly or
    // indirectly) can cascade into React's "Maximum update depth exceeded".
    setAnchors((prev) => (anchorsEqual(prev, next) ? prev : next));
  }, [allKeys, zoom]);

  // Measures each card wrapper's real rendered height so row spacing can
  // grow to fit an expanded card (see the autoPositions/rowLayoutHeight
  // memo above). Same equality-guard pattern as recomputeAnchors, for the
  // same reason: an unguarded setState inside a ResizeObserver callback
  // that itself feeds back into layout can cascade into a render loop.
  // Same zoom-descale + subpixel-rounding fix as recomputeAnchors above,
  // and for the same reason: this height is compared/consumed in the
  // unscaled content coordinate space, and an exact-equality compare on
  // a raw post-transform measurement is what let the loop through.
  const recomputeCardHeights = useCallback(() => {
    const next = new Map();
    wrapperRefs.current.forEach((el, key) => {
      if (!el) return;
      next.set(key, Math.round((el.getBoundingClientRect().height / zoom) * 2) / 2);
    });
    setCardHeights((prev) => (heightsEqual(prev, next) ? prev : next));
  }, [zoom]);

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
      // Divide by zoom: rect is post-transform but the SVG lives inside the
      // scaled container and expects unscaled coordinates.
      setDragPos({ x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom });
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
        // Don't allow duplicate links between the same two deeds (in either direction)
        const alreadyLinked = graphEdges.some(
          (edge) =>
            (edge.sourceKey === sourceKey && edge.targetKey === targetKey) ||
            (edge.sourceKey === targetKey && edge.targetKey === sourceKey)
        );
        if (alreadyLinked) {
          setError("These two deeds are already linked.");
          setTimeout(() => setError(""), 3000);
        } else {
          setEdgeDraft({ sourceKey, targetKey, areaTransferred: "", note: "" });
        }
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

  // Wheel to zoom (using passive: false so we can prevent browser scroll)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      // Figma/Google Maps style:
      // Scroll (no modifier) = Pan (native behavior, so we don't preventDefault)
      // Ctrl+Scroll or Pinch = Zoom
      if (!e.ctrlKey && !e.metaKey) {
        return; 
      }
      
      e.preventDefault();
      
      setZoom((oldZoom) => {
        // e.deltaY is usually 100 for a mouse wheel tick. 
        // A trackpad pinch or slow scroll might be 2 or 5.
        // We use an exponential scale so it feels smooth.
        const zoomFactor = Math.exp(-e.deltaY * 0.002);
        const newZoomRaw = oldZoom * zoomFactor;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoomRaw));
        
        if (newZoom === oldZoom) return oldZoom;

        // Get mouse position relative to the scroll container
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate where the mouse is in the unscaled content space
        const contentX = (el.scrollLeft + mouseX) / oldZoom;
        const contentY = (el.scrollTop + mouseY) / oldZoom;

        // Calculate where the scrollbar SHOULD be to keep the mouse stationary
        const newScrollLeft = contentX * newZoom - mouseX;
        const newScrollTop = contentY * newZoom - mouseY;

        // Store the target scroll position so useLayoutEffect can apply it AFTER the resize
        targetScrollRef.current = {
          x: newScrollLeft,
          y: newScrollTop,
        };

        return newZoom;
      });
    };
    
    // use passive: false so e.preventDefault() works
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  useLayoutEffect(() => {
    if (targetScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = targetScrollRef.current.x;
      scrollRef.current.scrollTop = targetScrollRef.current.y;
      targetScrollRef.current = null;
    }
  }, [zoom]);

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
  const zoomReset = () => setZoom(1);

  const centerView = () => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    
    // Total scrollable area based on content size and current zoom
    const contentWidth = Math.max(width, 900) * zoom;
    const contentHeight = Math.max(height, 400) * zoom;
    
    // Viewport dimensions
    const clientWidth = container.clientWidth;
    const clientHeight = container.clientHeight;
    
    // Calculate center offset
    const targetX = (contentWidth - clientWidth) / 2;
    const targetY = (contentHeight - clientHeight) / 2;
    
    container.scrollTo({
      left: Math.max(0, targetX),
      top: Math.max(0, targetY),
      behavior: "smooth"
    });
  };

  const zoomToFit = () => {
    if (!scrollRef.current || allCards.length === 0) return;
    const container = scrollRef.current;
    const clientW = container.clientWidth;
    const clientH = container.clientHeight;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allCards.forEach((deed) => {
      const key = keyFor(deed);
      const pos = resolvedPos(key, deed);
      if (!pos) return;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + NODE_W);
      maxY = Math.max(maxY, pos.y + NODE_H_ESTIMATE);
    });
    if (minX === Infinity) return;
    const graphW = maxX - minX + PADDING * 2;
    const graphH = maxY - minY + PADDING * 2;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(clientW / graphW, clientH / graphH) * 0.9));
    setZoom(newZoom);
    requestAnimationFrame(() => {
      container.scrollTo({
        left: ((minX + maxX) / 2) * newZoom - clientW / 2,
        top: ((minY + maxY) / 2) * newZoom - clientH / 2,
        behavior: "smooth",
      });
    });
  };

  const resetLayout = async () => {
    if (!(await customConfirm("Snap every deed back to the auto-arranged layout?"))) return;
    setDraftDeeds((prev) => prev.map((d) => ({ ...d, position: null })));
    const placed = savedDeeds.filter((d) => d.position);
    await Promise.all(placed.map((d) => api.updateDeed(workspace._id, d._id, { position: null })));
    load();
  };

  const addDraftDeed = async () => {
    if (sidebarDirty && selectedKey) {
      if (!(await customConfirm("Discard the unsaved changes on the currently selected deed?"))) return;
    }
    const tempId = nextTempId();
    setDraftDeeds((prev) => [...prev, { _tempId: tempId, ...blankDeed() }]);
    setSidebarDirty(false);
    setSelectedKey(tempId); // open the sidebar straight away, same as the old inline-expand-on-add did
  };

  const deriveChildDeed = async (parentDeed) => {
    if (sidebarDirty && selectedKey) {
      if (!(await customConfirm("Discard the unsaved changes on the currently selected deed?"))) return;
    }
    const tempId = nextTempId();
    const parentKey = keyFor(parentDeed);
    
    // Copy the parent's buyers as the new sellers, and copy all land parcels exactly
    const childDeed = {
      ...blankDeed(),
      _tempId: tempId,
      sellers: JSON.parse(JSON.stringify(parentDeed.purchasers || [])),
      landParcels: JSON.parse(JSON.stringify(parentDeed.landParcels || [])),
    };
    
    setDraftDeeds((prev) => [...prev, childDeed]);
    setPendingEdges((prev) => [...prev, { sourceKey: parentKey, targetKey: tempId, areaTransferred: "", note: "" }]);
    
    setSidebarDirty(false);
    setSelectedKey(tempId);
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
    if (!(await customConfirm("Delete this deed and every relationship touching it?"))) return false;
    await api.deleteDeed(workspace._id, id);
    load();
    if (selectedKey === id) {
      setSelectedKey(null);
      setSidebarDirty(false);
    }
    return true;
  };

  const confirmEdgeDraft = () => {
    // Guard: don't add a duplicate edge even if one was somehow queued
    const dup = graphEdges.some(
      (edge) =>
        (edge.sourceKey === edgeDraft.sourceKey && edge.targetKey === edgeDraft.targetKey) ||
        (edge.sourceKey === edgeDraft.targetKey && edge.targetKey === edgeDraft.sourceKey)
    );
    if (dup) {
      setError("These two deeds are already linked.");
      setTimeout(() => setError(""), 3000);
      setEdgeDraft(null);
      return;
    }
    setPendingEdges((prev) => [...prev, edgeDraft]);
    setEdgeDraft(null);
  };

  const removePendingEdge = (i) => {
    setPendingEdges((prev) => prev.filter((_, idx) => idx !== i));
    setSelectedEdge(null);
  };

  const deleteSavedRelationship = async (id) => {
    if (!(await customConfirm("Remove this link?"))) return;
    await api.deleteRelationship(workspace._id, id);
    setSelectedEdge(null);
    load();
  };

  const updateSavedRelationship = async (id, data) => {
    await api.updateRelationship(workspace._id, id, data);
    setSelectedEdge(null);
    load();
  };

  const updatePendingEdge = (idx, data) => {
    setPendingEdges((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...data } : e))
    );
    setSelectedEdge(null);
  };

  const handleEdgeClick = (edge, event) => {
    event.stopPropagation();
    // Position the popover near the click
    const contentRect = contentRef.current?.getBoundingClientRect();
    const x = contentRect ? (event.clientX - contentRect.left) / zoom : event.clientX;
    const y = contentRect ? (event.clientY - contentRect.top) / zoom : event.clientY;
    setSelectedEdge({
      ...edge,
      popX: x,
      popY: y,
      editArea: edge.areaTransferred || "",
      editNote: edge.note || "",
    });
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
      // If the selected card was a draft, its temp ID no longer exists after
      // save — clear it so the sidebar doesn't go blank looking for a stale key.
      if (selectedKey && selectedKey.startsWith("draft_")) {
        setSelectedKey(null);
        setSidebarDirty(false);
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

  // Global keyboard shortcuts for the canvas view
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept when the user is typing in a form field
      if (e.target.closest("input, textarea, select")) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setQuickFindOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsaved) handleSaveAll();
      }
      if (e.key === "Escape") {
        if (quickFindOpen) { setQuickFindOpen(false); setQuickFindQuery(""); }
        else if (selectedEdge) setSelectedEdge(null);
        else if (selectedKey) trySelect(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quickFindOpen, selectedEdge, selectedKey, hasUnsaved]);

  return (
    <div className="h-full flex flex-col bg-canvas text-ink">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border bg-surface shrink-0">
        <h2 className="text-xl font-semibold font-serif">{workspace.name}</h2>
        <div className="flex-1" />
        <div className="flex items-center border border-border rounded overflow-hidden text-sm">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="px-2 py-1.5 text-ink-muted hover:bg-surface-raised disabled:opacity-40"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={zoomReset}
            className="px-2 py-1.5 border-x border-border text-ink-muted hover:bg-surface-raised w-14"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="px-2 py-1.5 text-ink-muted hover:bg-surface-raised disabled:opacity-40"
            title="Zoom in"
          >
            +
          </button>
        </div>
        <button onClick={addDraftDeed} className="bg-brass text-canvas font-medium px-3 py-1.5 rounded text-sm">
          + Add Deed
        </button>
        <button
          onClick={onView}
          className="border border-border-strong text-ink px-3 py-1.5 rounded text-sm hover:bg-surface-raised transition-colors"
        >
          View
        </button>
        <button
          onClick={centerView}
          className="border border-border text-ink-muted px-3 py-1.5 rounded text-sm hover:text-ink hover:bg-surface-raised transition-colors"
        >
          Center View
        </button>
        <button
          onClick={resetLayout}
          className="border border-border text-ink-muted px-3 py-1.5 rounded text-sm hover:text-ink hover:bg-surface-raised transition-colors"
        >
          Reset Layout
        </button>
        <button
          onClick={zoomToFit}
          className="border border-border text-ink-muted px-3 py-1.5 rounded text-sm hover:text-ink hover:bg-surface-raised transition-colors"
          title="Zoom to fit all deeds in view"
        >
          Fit All
        </button>
        <button
          onClick={() => { setQuickFindOpen((v) => !v); if (!quickFindOpen) setQuickFindQuery(""); }}
          className={`border px-3 py-1.5 rounded text-sm transition-colors ${quickFindOpen ? "border-verdigris text-verdigris bg-verdigris/10" : "border-border text-ink-muted hover:text-ink hover:bg-surface-raised"}`}
          title="Find on canvas (Ctrl+F)"
        >
          Find
        </button>
        <button
          onClick={() => printWorkspace(savedDeeds, savedRelationships, workspace.name)}
          className="border border-border text-ink-muted px-3 py-1.5 rounded text-sm hover:text-ink hover:bg-surface-raised transition-colors"
          title="Print workspace deed list"
        >
          Print
        </button>
        <a
          href={api.exportWorkspaceUrl(workspace._id)}
          className="border border-verdigris text-verdigris px-3 py-1.5 rounded text-sm hover:bg-surface-raised"
        >
          Export to Excel
        </a>
        {hasUnsaved && (
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-verdigris text-canvas font-medium px-3 py-1.5 rounded text-sm disabled:opacity-60"
          >
            {saving ? "Saving…" : `Save (${draftDeeds.length} deed(s), ${pendingEdges.length} link(s))`}
          </button>
        )}
      </div>

      {(error || duplicateDeedNumbers.length > 0 || edgeDraft) && (
        <div className="px-4 py-3 border-b border-border bg-surface shrink-0 space-y-3 relative z-10 shadow-sm">
          {error && (
            <div className="flex items-center gap-2 bg-brick/10 border border-brick/30 text-brick px-3 py-2 rounded-lg text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {duplicateDeedNumbers.length > 0 && (
            <div className="border border-brass/40 bg-brass/10 text-brass rounded p-3 text-sm">
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
            <div className="border border-verdigris/30 bg-surface-raised shadow-md rounded-xl p-4 text-sm relative animate-zoom-in">
              <div className="absolute top-0 left-0 w-1 h-full bg-verdigris rounded-l-xl"></div>
              <p className="mb-3 text-ink">
                Creating link: <strong className="font-semibold">{labelForKey(edgeDraft.sourceKey)}</strong>
                <span className="text-ink-muted mx-2">→</span>
                <strong className="font-semibold">{labelForKey(edgeDraft.targetKey)}</strong>
              </p>
              <div className="flex gap-3 mb-4">
                <input
                  className="flex-1 border border-border-strong bg-canvas hover:bg-surface/50 text-ink placeholder:text-ink-faint rounded-md px-3 py-2 focus:outline-none focus:border-verdigris focus:ring-1 focus:ring-verdigris focus:bg-canvas transition-all duration-300 shadow-sm"
                  placeholder="Area/share transferred (optional)"
                  value={edgeDraft.areaTransferred}
                  onChange={(e) => setEdgeDraft({ ...edgeDraft, areaTransferred: e.target.value })}
                />
                <input
                  className="flex-1 border border-border-strong bg-canvas hover:bg-surface/50 text-ink placeholder:text-ink-faint rounded-md px-3 py-2 focus:outline-none focus:border-verdigris focus:ring-1 focus:ring-verdigris focus:bg-canvas transition-all duration-300 shadow-sm"
                  placeholder="Note (optional)"
                  value={edgeDraft.note}
                  onChange={(e) => setEdgeDraft({ ...edgeDraft, note: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={confirmEdgeDraft} className="bg-verdigris hover:bg-verdigris/90 text-canvas font-medium px-4 py-2 rounded-md transition-all duration-300 active:scale-95 shadow-sm">
                  Add this link
                </button>
                <button onClick={() => setEdgeDraft(null)} className="px-4 py-2 text-ink-muted hover:text-ink border border-transparent hover:border-border rounded-md transition-all duration-300 active:scale-95">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {allCards.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-canvas">
            <div className="bg-surface border border-border-strong rounded-2xl p-8 text-center max-w-sm shadow-xl animate-fade-in-up">
              <div className="w-16 h-16 bg-surface-raised border border-border rounded-xl flex items-center justify-center mx-auto mb-4 animate-zoom-in">
                <svg className="w-8 h-8 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-serif font-semibold text-ink mb-2">No Deeds Yet</h3>
              <p className="text-sm text-ink-muted mb-6 leading-relaxed">
                Your workspace is currently empty. Start by adding a root deed to build your lineage graph.
              </p>
              <button
                onClick={addDraftDeed}
                className="bg-brass hover:bg-brass-soft text-canvas font-medium px-5 py-2.5 rounded-lg text-sm transition-all duration-300 active:scale-95 shadow-sm w-full"
              >
                + Add First Deed
              </button>
            </div>
          </div>
        ) : (
          <>
          {quickFindOpen && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 animate-zoom-in" style={{ width: 360 }}>
              <div className="bg-surface border border-border-strong rounded-xl shadow-xl flex items-center px-3 gap-2">
                <svg className="w-4 h-4 text-ink-faint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  autoFocus
                  value={quickFindQuery}
                  onChange={(e) => setQuickFindQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") { setQuickFindOpen(false); setQuickFindQuery(""); } }}
                  placeholder="Find deed on canvas…"
                  className="flex-1 bg-transparent text-ink placeholder:text-ink-faint py-2.5 text-sm focus:outline-none"
                />
                {quickFindMatches && (
                  <span className="text-xs text-ink-faint shrink-0">{quickFindMatches.size} match{quickFindMatches.size !== 1 ? "es" : ""}</span>
                )}
                <button onClick={() => { setQuickFindOpen(false); setQuickFindQuery(""); }} className="text-ink-faint hover:text-ink text-xs p-1">✕</button>
              </div>
            </div>
          )}
          <div
            ref={scrollRef}
            onMouseDown={startPan}
            className="flex-1 overflow-auto canvas-scroll bg-canvas"
            style={{
              cursor: isPanning ? "grabbing" : "grab",
              backgroundImage: "radial-gradient(#2b323c 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
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
                    <path d="M0,0 L8,4 L0,8 Z" fill={WIRE_SAVED} />
                  </marker>
                  <marker id="arrowhead-edit-pending" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill={WIRE_PENDING} />
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
                  const isEdgeSelected = selectedEdge && (
                    (e.saved && selectedEdge._id === e._id) ||
                    (!e.saved && selectedEdge.pendingIndex === e.pendingIndex && !selectedEdge.saved)
                  );
                  const wireColor = isEdgeSelected ? WIRE_LIVE_DRAG : (e.saved ? WIRE_SAVED : WIRE_PENDING);
                  return (
                    <g key={e._id || `pending-${i}`}>
                      {/* Soft duplicate underneath for the glow - same path,
                          wider + blurred + translucent. */}
                      <path
                        d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                        fill="none"
                        stroke={wireColor}
                        strokeWidth={isEdgeSelected ? "8" : "5"}
                        opacity={isEdgeSelected ? "0.28" : "0.16"}
                        style={{ filter: "blur(2px)" }}
                      />
                      <path
                        d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                        fill="none"
                        stroke={wireColor}
                        strokeWidth={isEdgeSelected ? "2.2" : "1.6"}
                        strokeDasharray={e.saved ? undefined : "5,4"}
                        markerEnd={e.saved ? "url(#arrowhead-edit)" : "url(#arrowhead-edit-pending)"}
                        style={{ pointerEvents: "stroke", cursor: "pointer" }}
                        onClick={(ev) => handleEdgeClick(e, ev)}
                      />
                      {/* Invisible wider hit-target so thin wires are easier to click */}
                      <path
                        d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="14"
                        style={{ pointerEvents: "stroke", cursor: "pointer" }}
                        onClick={(ev) => handleEdgeClick(e, ev)}
                      />
                      {e.areaTransferred && (
                        <text
                          x={(x1 + x2) / 2}
                          y={midY - 4}
                          fontSize="10"
                          fill={WIRE_LABEL}
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
                        stroke={WIRE_LIVE_DRAG}
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
                      opacity: quickFindMatches && !quickFindMatches.has(key) ? 0.2 : 1,
                      transition: "opacity 0.2s ease",
                    }}
                  >
                    <div
                      ref={(el) => {
                        if (el) topDotRefs.current.set(key, el);
                        else topDotRefs.current.delete(key);
                      }}
                      title="Derives from (drop a link here)"
                      className="w-4 h-4 rounded-full bg-ink-faint border-2 border-canvas shadow mx-auto"
                      style={{ position: "absolute", top: -8, left: NODE_W / 2 - 8, zIndex: 5 }}
                    />

                    <DeedCard deed={deed} isDraft={isDraft} isSelected={isSelected} parentCount={connectionCounts.get(key)?.parents || 0} childCount={connectionCounts.get(key)?.children || 0} />

                    <div
                      ref={(el) => {
                        if (el) bottomDotRefs.current.set(key, el);
                        else bottomDotRefs.current.delete(key);
                      }}
                      onMouseDown={startDrag(key)}
                      title="Drag to link this deed to one derived from it"
                      className="w-4 h-4 rounded-full bg-brass border-2 border-canvas shadow mx-auto cursor-grab active:cursor-grabbing"
                      style={{ position: "absolute", bottom: -8, left: NODE_W / 2 - 8, zIndex: 5 }}
                    />
                  </div>
                );
              })}

              {/* Edge edit/delete popover — floating near the clicked wire */}
              {selectedEdge && (
                <div
                  style={{
                    position: "absolute",
                    left: Math.min(selectedEdge.popX, (Math.max(width, 900)) - 320),
                    top: selectedEdge.popY + 10,
                    zIndex: 50,
                    width: 300,
                  }}
                  onClick={(ev) => ev.stopPropagation()}
                  onMouseDown={(ev) => ev.stopPropagation()}
                >
                  <div className="bg-surface border border-border-strong rounded-lg shadow-xl p-4 text-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium text-ink text-xs uppercase tracking-wide">Edit Link</p>
                      <button
                        onClick={() => setSelectedEdge(null)}
                        className="text-ink-faint hover:text-ink text-xs"
                      >✕</button>
                    </div>
                    <p className="text-ink-muted text-xs mb-3 leading-relaxed">
                      <span className="text-ink font-medium">{labelForKey(selectedEdge.sourceKey)}</span>
                      {" → "}
                      <span className="text-ink font-medium">{labelForKey(selectedEdge.targetKey)}</span>
                    </p>
                    <div className="space-y-2 mb-3">
                      <input
                        className="w-full border border-border-strong bg-canvas text-ink placeholder:text-ink-faint rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-brass"
                        placeholder="Area/share transferred"
                        value={selectedEdge.editArea}
                        onChange={(ev) => setSelectedEdge({ ...selectedEdge, editArea: ev.target.value })}
                      />
                      <input
                        className="w-full border border-border-strong bg-canvas text-ink placeholder:text-ink-faint rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-brass"
                        placeholder="Note"
                        value={selectedEdge.editNote}
                        onChange={(ev) => setSelectedEdge({ ...selectedEdge, editNote: ev.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="bg-verdigris text-canvas font-medium text-xs px-3 py-1.5 rounded hover:opacity-90"
                        onClick={() => {
                          const data = { areaTransferred: selectedEdge.editArea, note: selectedEdge.editNote };
                          if (selectedEdge.saved) {
                            updateSavedRelationship(selectedEdge._id, data);
                          } else {
                            updatePendingEdge(selectedEdge.pendingIndex, data);
                          }
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="text-xs px-3 py-1.5 border border-border text-ink-muted hover:text-ink rounded"
                        onClick={() => setSelectedEdge(null)}
                      >
                        Cancel
                      </button>
                      <div className="flex-1" />
                      <button
                        className="text-brick text-xs hover:underline"
                        onClick={() =>
                          selectedEdge.saved
                            ? deleteSavedRelationship(selectedEdge._id)
                            : removePendingEdge(selectedEdge.pendingIndex)
                        }
                      >
                        Delete link
                      </button>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
          </>
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
                onDerive={() => deriveChildDeed(selectedDeed)}
                onPrint={() => printDeed(selectedDeed)}
                onDirtyChange={setSidebarDirty}
                onClose={() => trySelect(null)}
              />
            );
          })()}
      </div>
    </div>
  );
}
