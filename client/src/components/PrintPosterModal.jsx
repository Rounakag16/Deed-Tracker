import { useState, useMemo } from "react";
import { computePosterGrid, printTiledPoster, A4_PORTRAIT, A4_LANDSCAPE } from "../utils/posterPrint";
import { printWorkspace } from "../utils/print";
import { computeLayers, computePositions } from "../layout";

export default function PrintPosterModal({
  isOpen,
  onClose,
  deeds = [],
  relationships = [],
  workspaceName = "Workspace",
  customPositions = null,
  highlightMap = null,
  activeLayers = [],
}) {
  const [printMode, setPrintMode] = useState("poster"); // "poster" | "list"
  const [orientation, setOrientation] = useState("portrait"); // "portrait" | "landscape"
  const [scale, setScale] = useState(0.85);
  const [overlapPx, setOverlapPx] = useState(25);
  const [selectedPreviewPage, setSelectedPreviewPage] = useState(null);

  // Fallback layout calculations if needed
  const allKeys = useMemo(() => deeds.map((d) => String(d._id)), [deeds]);
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

  const layerById = useMemo(() => computeLayers(allKeys, graphEdges), [allKeys, graphEdges]);
  const fallbackPositions = useMemo(() => {
    return computePositions(allKeys, layerById, {
      nodeW: 420,
      nodeH: 180,
      colGap: 60,
      rowGap: 90,
      padding: 50,
      direction: "vertical",
    });
  }, [allKeys, layerById]);

  const getPos = (d) => {
    const key = String(d._id);
    if (customPositions?.get(key)) return customPositions.get(key);
    if (d.position) return d.position;
    return fallbackPositions.positions.get(key) || { x: 50, y: 50 };
  };

  // Compute graph bounds
  const bounds = useMemo(() => {
    if (deeds.length === 0) return { minX: 0, minY: 0, width: 800, height: 600 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    deeds.forEach((d) => {
      const pos = getPos(d);
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + 420);
      const plotsCount = (d.landParcels || []).reduce((sum, lp) => sum + (lp.plots?.length || 0), 0);
      const estH = 170 + plotsCount * 18 + (d.landParcels?.length || 0) * 22;
      maxY = Math.max(maxY, pos.y + estH);
    });
    return {
      minX: Math.max(0, minX - 30),
      minY: Math.max(0, minY - 30),
      width: Math.max(fallbackPositions.width, maxX - minX + 60),
      height: Math.max(fallbackPositions.height, maxY - minY + 60),
    };
  }, [deeds, customPositions, fallbackPositions]);

  // Compute grid specification
  const grid = useMemo(() => {
    return computePosterGrid(bounds, { orientation, scale, overlapPx });
  }, [bounds, orientation, scale, overlapPx]);

  // Map each deed to which page(s) it falls into
  const pageDeedMap = useMemo(() => {
    const map = new Map();
    grid.pages.forEach((p) => map.set(p.pageId, []));

    const a4 = grid.a4;
    deeds.forEach((d) => {
      const pos = getPos(d);
      const cardX = (pos.x - bounds.minX) * scale;
      const cardY = (pos.y - bounds.minY) * scale;
      const cardW = 420 * scale;
      const cardH = 180 * scale;

      grid.pages.forEach((p) => {
        const pageLeft = (p.graphX - bounds.minX) * scale;
        const pageTop = (p.graphY - bounds.minY) * scale;
        const pageRight = pageLeft + a4.contentWidthPx;
        const pageBottom = pageTop + a4.contentHeightPx;

        // Overlap test
        const overlaps =
          cardX < pageRight &&
          cardX + cardW > pageLeft &&
          cardY < pageBottom &&
          cardY + cardH > pageTop;

        if (overlaps) {
          map.get(p.pageId)?.push(d);
        }
      });
    });

    return map;
  }, [deeds, grid, bounds, scale]);

  // Quick auto-fit scale calculations
  const fitWidthScale = useMemo(() => {
    const a4 = orientation === "landscape" ? A4_LANDSCAPE : A4_PORTRAIT;
    const availW = a4.contentWidthPx - overlapPx;
    return Math.min(1.1, Math.max(0.4, Number((availW / bounds.width).toFixed(2))));
  }, [bounds.width, orientation, overlapPx]);

  const fitTwoColScale = useMemo(() => {
    const a4 = orientation === "landscape" ? A4_LANDSCAPE : A4_PORTRAIT;
    const availW = (a4.contentWidthPx - overlapPx) * 2;
    return Math.min(1.1, Math.max(0.4, Number((availW / bounds.width).toFixed(2))));
  }, [bounds.width, orientation, overlapPx]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (printMode === "list") {
      printWorkspace(deeds, relationships, workspaceName);
      onClose();
      return;
    }

    printTiledPoster(deeds, relationships, workspaceName, {
      orientation,
      scale,
      overlapPx,
      positions: customPositions,
      highlightMap,
      activeLayers,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-canvas/80 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-surface border border-border-strong rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-raised">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brass/15 border border-brass/30 flex items-center justify-center text-brass font-bold text-lg">
              🖨️
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                Print Workspace & Lineage Poster
                <span className="text-xs font-mono font-medium text-verdigris bg-verdigris/15 border border-verdigris/30 px-2 py-0.5 rounded-full">
                  A4 Matrix ({grid.rows}×{grid.cols} = {grid.totalPages} Sheets)
                </span>
              </h2>
              <p className="text-xs text-ink-faint">
                {deeds.length} deeds · {relationships.length} connections · Page numbering [Row][Column] (1a, 1b, 2a, 2b)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-faint hover:text-ink hover:bg-surface transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher: Poster vs List */}
        <div className="flex border-b border-border bg-surface px-6 pt-2">
          <button
            onClick={() => setPrintMode("poster")}
            className={`pb-2.5 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              printMode === "poster"
                ? "border-brass text-brass font-semibold"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <span>🗺️ Tiled A4 Wall Poster</span>
            <span className="text-[10px] bg-brass/15 text-brass px-1.5 py-0.5 rounded font-mono font-bold">
              1a, 1b, 2a...
            </span>
          </button>
          <button
            onClick={() => setPrintMode("list")}
            className={`pb-2.5 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              printMode === "list"
                ? "border-brass text-brass font-semibold"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <span>📋 Full Deed Records (Table Report)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {printMode === "list" ? (
            <div className="bg-surface-raised border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-ink">Deed Record List View</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Prints a clean, ink-friendly multi-page document containing all {deeds.length} deeds in this workspace as detailed, structured records with full registration information, purchasers, sellers, land parcels, and plots.
              </p>
              <div className="text-xs text-ink-faint bg-surface p-3 rounded-lg border border-border">
                💡 Tip: For visual lineage charts taped together on walls or tables, switch to the <strong>Tiled A4 Wall Poster</strong> tab.
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Controls Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-surface-raised border border-border rounded-xl p-4">
                {/* Orientation */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint block mb-2">
                    Sheet Orientation
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setOrientation("portrait")}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                        orientation === "portrait"
                          ? "bg-brass/15 border-brass text-brass font-semibold shadow-sm"
                          : "border-border text-ink-muted hover:bg-surface"
                      }`}
                    >
                      <span>📄</span> Portrait
                    </button>
                    <button
                      onClick={() => setOrientation("landscape")}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                        orientation === "landscape"
                          ? "bg-brass/15 border-brass text-brass font-semibold shadow-sm"
                          : "border-border text-ink-muted hover:bg-surface"
                      }`}
                    >
                      <span>📑</span> Landscape
                    </button>
                  </div>
                </div>

                {/* Scale presets */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint block mb-2">
                    Scale: {Math.round(scale * 100)}%
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <button
                      onClick={() => setScale(1.0)}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                        scale === 1.0
                          ? "bg-brass text-canvas font-bold border-brass"
                          : "border-border text-ink-muted hover:bg-surface"
                      }`}
                    >
                      100%
                    </button>
                    <button
                      onClick={() => setScale(0.85)}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                        scale === 0.85
                          ? "bg-brass text-canvas font-bold border-brass"
                          : "border-border text-ink-muted hover:bg-surface"
                      }`}
                    >
                      85%
                    </button>
                    <button
                      onClick={() => setScale(0.70)}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                        scale === 0.70
                          ? "bg-brass text-canvas font-bold border-brass"
                          : "border-border text-ink-muted hover:bg-surface"
                      }`}
                    >
                      70%
                    </button>
                    <button
                      onClick={() => setScale(fitWidthScale)}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                        scale === fitWidthScale
                          ? "bg-brass text-canvas font-bold border-brass"
                          : "border-border text-ink-muted hover:bg-surface"
                      }`}
                      title={`Scale ${Math.round(fitWidthScale * 100)}% so the graph fits 1 sheet wide`}
                    >
                      Fit 1-Col
                    </button>
                    {bounds.width > 900 && (
                      <button
                        onClick={() => setScale(fitTwoColScale)}
                        className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                          scale === fitTwoColScale
                            ? "bg-brass text-canvas font-bold border-brass"
                            : "border-border text-ink-muted hover:bg-surface"
                        }`}
                        title={`Scale ${Math.round(fitTwoColScale * 100)}% so the graph fits 2 sheets wide`}
                      >
                        Fit 2-Col
                      </button>
                    )}
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="1.2"
                    step="0.05"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-full accent-brass cursor-pointer"
                  />
                </div>

                {/* Overlap margin */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint block mb-2">
                    Overlap / Glue Margin
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: "15px (~4mm)", val: 15 },
                      { label: "25px (~7mm)", val: 25 },
                      { label: "40px (~11mm)", val: 40 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => setOverlapPx(opt.val)}
                        className={`px-2 py-2 text-center rounded text-[11px] border transition-colors ${
                          overlapPx === opt.val
                            ? "bg-verdigris/15 border-verdigris text-verdigris font-semibold"
                            : "border-border text-ink-muted hover:bg-surface"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-ink-faint mt-1.5">
                    Overlap strip allows taping/gluing sheets together seamlessly.
                  </p>
                </div>
              </div>

              {/* Grid Layout Summary Banner */}
              <div className="bg-canvas/50 border border-border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface border border-border flex flex-col items-center justify-center font-mono font-bold text-xs text-brass">
                    <span>{grid.rows}×{grid.cols}</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-ink flex items-center gap-2">
                      <span>Total: <strong>{grid.totalPages} A4 Sheets</strong></span>
                      <span className="text-[10px] text-ink-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                        {grid.rows} Row{grid.rows > 1 ? "s" : ""} × {grid.cols} Column{grid.cols > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-faint font-mono mt-0.5">
                      Sheets: {grid.pages.map((p) => p.pageIdUpper).join(", ")}
                    </div>
                  </div>
                </div>

                {activeLayers.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-ink-muted bg-surface px-3 py-1.5 rounded-lg border border-border">
                    <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Highlights:</span>
                    <span className="text-ink font-medium">
                      {activeLayers.map((l) => `"${l.value}"`).join(", ")} preserved in print
                    </span>
                  </div>
                )}
              </div>

              {/* Matrix Sheet Preview Map */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <span>Sheet Matrix Preview</span>
                    <span className="text-[10px] text-ink-faint font-normal">
                      (Click any sheet to inspect cards)
                    </span>
                  </label>
                  <span className="text-[10px] text-ink-faint">
                    Numbered as [Row][Column] · e.g. 1a, 1b, 2a, 2b
                  </span>
                </div>

                <div
                  className="grid gap-3 p-4 bg-canvas/60 border border-border rounded-xl overflow-x-auto"
                  style={{
                    gridTemplateColumns: `repeat(${grid.cols}, minmax(130px, 1fr))`,
                  }}
                >
                  {grid.pages.map((page) => {
                    const pageDeeds = pageDeedMap.get(page.pageId) || [];
                    const isSelected = selectedPreviewPage === page.pageId;

                    return (
                      <div
                        key={page.pageId}
                        onClick={() =>
                          setSelectedPreviewPage(isSelected ? null : page.pageId)
                        }
                        className={`group relative border-2 rounded-xl p-3 cursor-pointer transition-all flex flex-col justify-between min-h-[140px] ${
                          isSelected
                            ? "bg-surface-raised border-brass shadow-lg scale-[1.02]"
                            : "bg-surface border-border hover:border-ink-faint"
                        }`}
                      >
                        {/* Sheet top bar */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-mono font-bold text-xs px-2 py-0.5 rounded shadow-sm ${
                              isSelected
                                ? "bg-brass text-canvas"
                                : "bg-surface-raised text-ink border border-border"
                            }`}
                          >
                            {page.pageIdUpper}
                          </span>
                          <span className="text-[9px] font-mono text-ink-faint">
                            R{page.row}·C{page.colLetter.toUpperCase()}
                          </span>
                        </div>

                        {/* Visual mini card representations */}
                        <div className="my-2 space-y-1">
                          {pageDeeds.length === 0 ? (
                            <div className="text-[10px] text-ink-faint text-center py-4 italic">
                              Margin / wire space
                            </div>
                          ) : (
                            pageDeeds.slice(0, 3).map((d) => {
                              const hits = highlightMap?.get(String(d._id));
                              const hasHit = hits && hits.length > 0;
                              return (
                                <div
                                  key={d._id}
                                  className={`text-[9.5px] px-1.5 py-1 rounded truncate border flex items-center justify-between ${
                                    hasHit
                                      ? "bg-amber-500/15 border-amber-500/40 text-ink font-semibold"
                                      : "bg-surface-raised border-border text-ink-muted"
                                  }`}
                                >
                                  <span className="truncate">
                                    Deed {d.deedInfo?.deedNumber || "—"}
                                  </span>
                                  {hasHit && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 ml-1" />
                                  )}
                                </div>
                              );
                            })
                          )}
                          {pageDeeds.length > 3 && (
                            <div className="text-[8.5px] text-ink-faint text-center font-mono">
                              +{pageDeeds.length - 3} more
                            </div>
                          )}
                        </div>

                        {/* Sheet bottom indicators */}
                        <div className="pt-1.5 border-t border-border flex items-center justify-between text-[8px] font-mono text-ink-faint">
                          <span>{pageDeeds.length} deed{pageDeeds.length === 1 ? "" : "s"}</span>
                          {page.hasRight && <span>Attach ◄►</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected page details popup */}
                {selectedPreviewPage && (
                  <div className="mt-2 p-3 bg-surface border border-brass/40 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-brass flex items-center justify-between">
                      <span>Sheet {selectedPreviewPage.toUpperCase()} Inspection:</span>
                      <button
                        onClick={() => setSelectedPreviewPage(null)}
                        className="text-ink-faint hover:text-ink"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-ink-muted">
                      Deeds on this sheet:{" "}
                      {(pageDeedMap.get(selectedPreviewPage) || [])
                        .map((d) => `Deed ${d.deedInfo?.deedNumber || "(no deed)"}`)
                        .join(", ") || "None (connecting lineage wires only)"}
                    </p>
                  </div>
                )}
              </div>

              {/* Physical Assembly Guide Walkthrough */}
              <div className="bg-surface-raised border border-border rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-ink flex items-center gap-2">
                  <span>📌 Easy Physical Assembly Instructions</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-ink-muted">
                  <div className="bg-surface p-2.5 rounded-lg border border-border space-y-1">
                    <div className="font-semibold text-ink text-[11px]">1. Print All Sheets</div>
                    <p className="text-[10px] text-ink-faint leading-relaxed">
                      Click Print below to send all {grid.totalPages} pages to your printer on A4 sheets.
                    </p>
                  </div>
                  <div className="bg-surface p-2.5 rounded-lg border border-border space-y-1">
                    <div className="font-semibold text-ink text-[11px]">2. Lay Out Grid</div>
                    <p className="text-[10px] text-ink-faint leading-relaxed">
                      Arrange pages in order: Top row: <strong>1a, 1b</strong>. Second row: <strong>2a, 2b</strong>, etc.
                    </p>
                  </div>
                  <div className="bg-surface p-2.5 rounded-lg border border-border space-y-1">
                    <div className="font-semibold text-ink text-[11px]">3. Align & Stick</div>
                    <p className="text-[10px] text-ink-faint leading-relaxed">
                      Line up the corner <strong>[+] crosshairs</strong> and tape along the shaded overlap glue margin.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-surface-raised">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface rounded-lg transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-brass text-canvas hover:bg-brass-hover transition-colors shadow-lg flex items-center gap-2"
            >
              <span>🖨️</span>
              <span>
                {printMode === "poster"
                  ? `Print Tiled A4 Poster (${grid.totalPages} Sheets)`
                  : "Print Deed Record List"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

