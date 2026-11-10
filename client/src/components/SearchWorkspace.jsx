import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import DeedCard from "./DeedCard";
import DeedSidebar from "./DeedSidebar";
import PrintPosterModal from "./PrintPosterModal";
import { computeLayers, computePositions } from "../layout";
import { deedLabel } from "../utils/deedLabel";
import { printDeed, printWorkspace } from "../utils/print";
import {
  HIGHLIGHT_COLORS,
  SEARCHABLE_FIELDS,
  computeHighlights,
  countMatchesPerLayer,
} from "../utils/highlightSearch";

// Wire colors matching theme
const WIRE_SAVED = "#a9723a"; // brass-soft
const WIRE_LABEL = "#8d94a3"; // ink-muted
const WIRE_SELECTED = "#4f9a8c"; // verdigris

const NODE_W = 420;
const NODE_H_ESTIMATE = 180;
const COL_GAP = 60;
const ROW_GAP = 90;
const PADDING = 50;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

export default function SearchWorkspace({ workspace }) {
  const [deeds, setDeeds] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Cumulative highlight layers state
  const [highlightLayers, setHighlightLayers] = useState([]);
  const [searchField, setSearchField] = useState(SEARCHABLE_FIELDS[0].value);
  const [searchValue, setSearchValue] = useState("");
  const [exactMatch, setExactMatch] = useState(false);

  const inputRef = useRef(null);
  const panRef = useRef(null);
  const contentRef = useRef(null);
  const scrollRef = useRef(null);
  const targetScrollRef = useRef(null);
  const wrapperRefs = useRef(new Map());
  const topDotRefs = useRef(new Map());
  const bottomDotRefs = useRef(new Map());
  const [cardHeights, setCardHeights] = useState(new Map());

  // Load deeds & relationships for the current workspace
  const load = () => {
    if (!workspace?._id) return;
    api.listDeeds(workspace._id).then(setDeeds);
    api.listRelationships(workspace._id).then(setRelationships);
  };
  useEffect(load, [workspace?._id]);

  const keyFor = (d) => String(d._id);
  const allCards = deeds;
  const allKeys = useMemo(() => allCards.map(keyFor), [allCards]);

  // Compute cumulative highlight results
  const highlightMap = useMemo(
    () => computeHighlights(allCards, keyFor, highlightLayers),
    [allCards, highlightLayers]
  );

  const matchCounts = useMemo(
    () => countMatchesPerLayer(allCards, highlightLayers),
    [allCards, highlightLayers]
  );

  const hasActiveHighlights = highlightLayers.length > 0;
  const nextColor = HIGHLIGHT_COLORS[highlightLayers.length % HIGHLIGHT_COLORS.length];

  const handleAddHighlight = (e) => {
    e?.preventDefault();
    if (!searchValue.trim()) return;
    const colorIndex = highlightLayers.length % HIGHLIGHT_COLORS.length;
    setHighlightLayers((prev) => [
      ...prev,
      {
        id: Date.now(),
        field: searchField,
        value: searchValue.trim(),
        exact: exactMatch,
        color: HIGHLIGHT_COLORS[colorIndex],
      },
    ]);
    setSearchValue("");
    inputRef.current?.focus();
  };

  const handleRemoveLayer = (id) => {
    setHighlightLayers((prev) => prev.filter((l) => l.id !== id));
  };

  const handleClearAllLayers = () => {
    setHighlightLayers([]);
  };

  const selectedDeed = selectedKey ? allCards.find((c) => keyFor(c) === selectedKey) : null;

  // Graph edges for DAG
  const graphEdges = useMemo(
    () =>
      relationships.map((r) => ({
        sourceKey: String(r.sourceDeedId),
        targetKey: String(r.targetDeedId),
        areaTransferred: r.areaTransferred,
        _id: r._id,
      })),
    [relationships]
  );

  // Connection counts
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

  // Layout calculations
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

  // Auto row-height expansion
  const { autoPositions, rowLayoutHeight } = useMemo(() => {
    const heightsByLayer = new Map();
    allCards.forEach((deed) => {
      const key = keyFor(deed);
      if (deed.position) return;
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

    return {
      autoPositions: next,
      rowLayoutHeight: layers.length ? cumulative - ROW_GAP + PADDING : PADDING * 2,
    };
  }, [allCards, allKeys, layerById, cardHeights, positions]);

  const { width, height } = useMemo(() => {
    let maxX = layoutWidth;
    let maxY = rowLayoutHeight;
    allCards.forEach((deed) => {
      const pos = deed.position;
      if (!pos) return;
      maxX = Math.max(maxX, pos.x + NODE_W + PADDING);
      maxY = Math.max(maxY, pos.y + NODE_H_ESTIMATE + PADDING);
    });
    return { width: maxX, height: maxY };
  }, [allCards, layoutWidth, rowLayoutHeight]);

  // A manually-placed deed uses its stored position; otherwise fall back to
  // the auto-arranged layered position.
  const resolvedPos = (key, deed) => {
    if (deed.position) return deed.position;
    return autoPositions.get(key);
  };

  // Connect wires directly to card positions in unscaled content space.
  // Each card is NODE_W wide, with its top dot at (x + NODE_W/2, y)
  // and bottom dot at (x + NODE_W/2, y + height).
  // Derived synchronously as a memo so it never triggers state updates or render loops.
  const anchors = useMemo(() => {
    const map = new Map();
    allCards.forEach((deed) => {
      const key = keyFor(deed);
      const pos = resolvedPos(key, deed);
      if (!pos) return;
      const h = cardHeights.get(key) || NODE_H_ESTIMATE;
      map.set(key, {
        top: { x: pos.x + NODE_W / 2, y: pos.y },
        bottom: { x: pos.x + NODE_W / 2, y: pos.y + h },
      });
    });
    return map;
  }, [allCards, autoPositions, cardHeights]);

  // Measures each card's real rendered height so row spacing can grow
  // to fit taller cards. Uses offsetHeight (exact integer CSS layout pixels,
  // unaffected by zoom/transform subpixel noise) and only updates state if a
  // height actually changed, preventing feedback loops.
  useEffect(() => {
    const updateHeights = () => {
      let changed = false;
      setCardHeights((prev) => {
        const next = new Map(prev);
        wrapperRefs.current.forEach((el, key) => {
          if (!el) return;
          const h = el.offsetHeight;
          if (h && next.get(key) !== h) {
            next.set(key, h);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    };

    updateHeights();

    const observer = new ResizeObserver(updateHeights);
    wrapperRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [allKeys]);

  // Pan interaction
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

  // Wheel to zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((oldZoom) => {
        const zoomFactor = Math.exp(-e.deltaY * 0.002);
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * zoomFactor));
        if (newZoom === oldZoom) return oldZoom;

        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const contentX = (el.scrollLeft + mouseX) / oldZoom;
        const contentY = (el.scrollTop + mouseY) / oldZoom;

        targetScrollRef.current = {
          x: contentX * newZoom - mouseX,
          y: contentY * newZoom - mouseY,
        };
        return newZoom;
      });
    };
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
    const contentWidth = Math.max(width, 900) * zoom;
    const contentHeight = Math.max(height, 400) * zoom;
    const clientWidth = container.clientWidth;
    const clientHeight = container.clientHeight;
    container.scrollTo({
      left: Math.max(0, (contentWidth - clientWidth) / 2),
      top: Math.max(0, (contentHeight - clientHeight) / 2),
      behavior: "smooth",
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

  const currentFieldLabel =
    SEARCHABLE_FIELDS.find((sf) => sf.value === searchField)?.label || searchField;

  return (
    <div className="h-full flex flex-col bg-canvas text-ink select-none">
      {/* Top Search Controls Bar */}
      <div className="border-b border-border bg-surface shrink-0 px-4 py-3 space-y-2.5 shadow-md z-20">
        <div className="flex flex-wrap items-center gap-3">
          {/* Workspace Title Indicator */}
          <div className="flex items-center gap-2 pr-2 border-r border-border shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-verdigris" />
            <span className="font-serif font-bold text-base text-ink">
              {workspace?.name}
            </span>
            <span className="text-xs bg-surface-raised border border-border text-ink-muted px-2 py-0.5 rounded font-mono">
              Search
            </span>
          </div>

          {/* Search Form */}
          <form onSubmit={handleAddHighlight} className="flex flex-wrap items-center gap-2 flex-1 min-w-[320px]">
            {/* Field Dropdown */}
            <select
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
              className="border border-border-strong bg-canvas text-ink rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-brass cursor-pointer"
            >
              {SEARCHABLE_FIELDS.map((sf) => (
                <option key={sf.value} value={sf.value}>
                  {sf.label}
                </option>
              ))}
            </select>

            {/* Value Input */}
            <div className="relative flex-1 min-w-[160px] max-w-[280px]">
              <input
                ref={inputRef}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={`Search ${currentFieldLabel}…`}
                className="w-full border border-border-strong bg-canvas text-ink placeholder:text-ink-faint rounded-lg pl-3 pr-7 py-1.5 text-xs focus:outline-none focus:border-brass transition-colors"
              />
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: nextColor }}
                title={`Next highlight color: ${nextColor}`}
              />
            </div>

            {/* Exact Match Checkbox */}
            <label className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink cursor-pointer select-none px-1">
              <input
                type="checkbox"
                checked={exactMatch}
                onChange={(e) => setExactMatch(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border-strong text-brass focus:ring-brass accent-brass"
              />
              <span>Exact</span>
            </label>

            {/* Add Highlight Button */}
            <button
              type="submit"
              disabled={!searchValue.trim()}
              className="bg-brass hover:bg-brass-soft text-canvas font-medium text-xs px-3.5 py-1.5 rounded-lg disabled:opacity-40 transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: nextColor }} />
              <span>+ Add Highlight</span>
            </button>
          </form>

          {/* Zoom & View Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center border border-border rounded overflow-hidden text-xs">
              <button
                onClick={zoomOut}
                disabled={zoom <= MIN_ZOOM}
                className="px-2 py-1 text-ink-muted hover:bg-surface-raised disabled:opacity-40"
                title="Zoom out"
              >
                −
              </button>
              <button
                onClick={zoomReset}
                className="px-2 py-1 border-x border-border text-ink-muted hover:bg-surface-raised w-12 text-center"
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={zoomIn}
                disabled={zoom >= MAX_ZOOM}
                className="px-2 py-1 text-ink-muted hover:bg-surface-raised disabled:opacity-40"
                title="Zoom in"
              >
                +
              </button>
            </div>

            <button
              onClick={centerView}
              className="border border-border text-ink-muted px-2.5 py-1 rounded text-xs hover:text-ink hover:bg-surface-raised transition-colors"
            >
              Center
            </button>
            <button
              onClick={zoomToFit}
              className="border border-border text-ink-muted px-2.5 py-1 rounded text-xs hover:text-ink hover:bg-surface-raised transition-colors"
            >
              Fit All
            </button>
            <button
              onClick={() => setPrintModalOpen(true)}
              className="border border-border text-ink-muted px-2.5 py-1 rounded text-xs hover:text-ink hover:bg-surface-raised transition-colors flex items-center gap-1.5"
              title="Print workspace A4 tiled poster or report"
            >
              <span>🖨️</span> Print
            </button>
          </div>
        </div>

        {/* Active Cumulative Highlight Chips Row */}
        {highlightLayers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/70 text-xs">
            <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mr-1">
              Active Highlights ({highlightLayers.length}):
            </span>
            {highlightLayers.map((layer) => {
              const count = matchCounts.get(layer.id) || 0;
              const fieldLabel =
                SEARCHABLE_FIELDS.find((sf) => sf.value === layer.field)?.label || layer.field;
              return (
                <div
                  key={layer.id}
                  className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1 border shadow-sm transition-all bg-surface-raised"
                  style={{ borderColor: `${layer.color}60` }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: layer.color }}
                  />
                  <span className="text-ink-muted font-normal">{fieldLabel}:</span>
                  <span className="font-semibold text-ink">"{layer.value}"</span>
                  {layer.exact && (
                    <span className="text-[9px] bg-surface text-ink-faint px-1 rounded border border-border">
                      exact
                    </span>
                  )}
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ml-0.5"
                    style={{
                      backgroundColor: `${layer.color}20`,
                      color: layer.color,
                    }}
                  >
                    {count} deed{count === 1 ? "" : "s"}
                  </span>
                  <button
                    onClick={() => handleRemoveLayer(layer.id)}
                    className="text-ink-faint hover:text-brick text-xs ml-0.5 transition-colors"
                    title="Remove this highlight"
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            <button
              onClick={handleClearAllLayers}
              className="text-[11px] text-brick/80 hover:text-brick hover:underline transition-colors font-medium ml-auto"
            >
              Clear all highlights
            </button>
          </div>
        )}
      </div>

      {/* Canvas Workspace Graph Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
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
              {/* SVG Connector Wires Layer */}
              <svg
                width={Math.max(width, 900)}
                height={Math.max(height, 400)}
                style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
              >
                <defs>
                  <marker
                    id="arrowhead-search"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" fill={WIRE_SAVED} />
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
                    <g key={e._id || i}>
                      {/* Soft glow underlying wire */}
                      <path
                        d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                        fill="none"
                        stroke={WIRE_SAVED}
                        strokeWidth="5"
                        opacity="0.16"
                        style={{ filter: "blur(2px)" }}
                      />
                      {/* Main connecting wire */}
                      <path
                        d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                        fill="none"
                        stroke={WIRE_SAVED}
                        strokeWidth="1.6"
                        markerEnd="url(#arrowhead-search)"
                      />
                      {/* Area transferred label */}
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
              </svg>

              {/* Condensed Deed Cards */}
              {allCards.map((deed) => {
                const key = keyFor(deed);
                const pos = resolvedPos(key, deed);
                if (!pos) return null;
                const isSelected = selectedKey === key;
                const isMatching = highlightMap.has(key);

                // When highlights are active: matching cards are 100% opacity; non-matching are dimmed (0.22 opacity)
                const opacity = hasActiveHighlights ? (isMatching ? 1 : 0.22) : 1;

                return (
                  <div
                    key={key}
                    data-card-key={key}
                    data-card-wrapper="true"
                    ref={(el) => {
                      if (el) wrapperRefs.current.set(key, el);
                      else wrapperRefs.current.delete(key);
                    }}
                    onClick={() => setSelectedKey(isSelected ? null : key)}
                    style={{
                      position: "absolute",
                      left: pos.x,
                      top: pos.y,
                      width: NODE_W,
                      cursor: "pointer",
                      zIndex: isSelected ? 15 : isMatching ? 8 : 1,
                      opacity,
                      transition: "opacity 0.25s ease, transform 0.2s ease",
                    }}
                  >
                    {/* Top Anchor Dot */}
                    <div
                      ref={(el) => {
                        if (el) topDotRefs.current.set(key, el);
                        else topDotRefs.current.delete(key);
                      }}
                      title="Derives from earlier deed"
                      className="w-4 h-4 rounded-full bg-ink-faint border-2 border-canvas shadow mx-auto"
                      style={{ position: "absolute", top: -8, left: NODE_W / 2 - 8, zIndex: 5 }}
                    />

                    {/* Condensed DeedCard with highlightHits passed */}
                    <DeedCard
                      deed={deed}
                      isDraft={false}
                      isSelected={isSelected}
                      parentCount={connectionCounts.get(key)?.parents || 0}
                      childCount={connectionCounts.get(key)?.children || 0}
                      highlightHits={highlightMap.get(key) || null}
                    />

                    {/* Bottom Anchor Dot */}
                    <div
                      ref={(el) => {
                        if (el) bottomDotRefs.current.set(key, el);
                        else bottomDotRefs.current.delete(key);
                      }}
                      title="Derived deed connector"
                      className="w-4 h-4 rounded-full bg-brass border-2 border-canvas shadow mx-auto"
                      style={{ position: "absolute", bottom: -8, left: NODE_W / 2 - 8, zIndex: 5 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Deed Sidebar for detailed review & printing */}
        {selectedDeed && (
          <DeedSidebar
            key={selectedKey}
            deed={selectedDeed}
            isDraft={false}
            onPrint={() => printDeed(selectedDeed)}
            onClose={() => setSelectedKey(null)}
          />
        )}

        {/* Tiled Poster & Report Printing Modal */}
        <PrintPosterModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          deeds={deeds}
          relationships={relationships}
          workspaceName={workspace?.name}
          customPositions={autoPositions}
          highlightMap={highlightMap}
          activeLayers={highlightLayers}
        />
      </div>
    </div>
  );
}

