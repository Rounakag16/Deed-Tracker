// posterPrint.js - Tiled multi-page A4 printing engine for DeedTracker.
//
// Slices the complete DAG graph (all deed cards and lineage connecting wires)
// across a grid of A4 sheets with [Row][Col] page numbering (e.g. 1a, 1b, 2a, 2b).
// Includes assembly glue guides, neighbor indicators, corner crosshairs, and a grid map.

import { computeLayers, computePositions } from "../layout";
import { isValueMatch } from "./highlightSearch";

const MM_TO_PX = 3.7795275591; // 1 mm in CSS pixels at 96 DPI

// A4 sheet dimensions (portrait: 210x297mm, landscape: 297x210mm)
export const A4_PORTRAIT = {
  widthMm: 210,
  heightMm: 297,
  paddingMm: 7,
  contentWidthPx: Math.floor((210 - 14) * MM_TO_PX), // ~740px
  contentHeightPx: Math.floor((297 - 14 - 14) * MM_TO_PX), // ~1016px (minus header/footer)
};

export const A4_LANDSCAPE = {
  widthMm: 297,
  heightMm: 210,
  paddingMm: 7,
  contentWidthPx: Math.floor((297 - 14) * MM_TO_PX), // ~1070px
  contentHeightPx: Math.floor((210 - 14 - 14) * MM_TO_PX), // ~688px (minus header/footer)
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Converts a column index (0, 1, 2...) into alphabet ('a', 'b', 'c'...)
export function colToAlphabet(c) {
  let result = "";
  let n = c;
  while (n >= 0) {
    result = String.fromCharCode(97 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

// In-place highlight generator for HTML output
function highlightValHtml(val, fieldKey, highlightHits) {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (!str) return "";
  if (!highlightHits || highlightHits.length === 0) return escapeHtml(str);

  const hit = highlightHits.find((h) => {
    if (h.fieldKey === fieldKey) return isValueMatch(str, h.layerValue, h.exact);
    if (fieldKey === "purchaser" && (h.fieldKey === "purchaser" || h.fieldKey === "purchaserName")) {
      return isValueMatch(str, h.layerValue, h.exact);
    }
    if (fieldKey === "seller" && (h.fieldKey === "seller" || h.fieldKey === "sellerName")) {
      return isValueMatch(str, h.layerValue, h.exact);
    }
    return false;
  });

  if (!hit) return escapeHtml(str);

  const query = String(hit.layerValue || "").trim();
  const color = hit.color || "#e6a93c";

  // Substring matching
  if (query) {
    const lowerStr = str.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerStr.indexOf(lowerQuery);

    if (idx !== -1) {
      const before = escapeHtml(str.slice(0, idx));
      const match = escapeHtml(str.slice(idx, idx + query.length));
      const after = escapeHtml(str.slice(idx + query.length));
      return `${before}<mark style="background-color: ${color}35; color: #111; font-weight: 800; border: 1.5px solid ${color}; border-radius: 3px; padding: 0 3px;">${match}</mark>${after}`;
    }
  }

  return `<mark style="background-color: ${color}35; color: #111; font-weight: 800; border: 1.5px solid ${color}; border-radius: 3px; padding: 0 3px;">${escapeHtml(str)}</mark>`;
}

// Computes the grid specification (rows, columns, tile bounds) for a given graph
export function computePosterGrid(bounds, options = {}) {
  const {
    orientation = "portrait", // "portrait" | "landscape"
    scale = 1,               // 0.4 to 1.5
    overlapPx = 25,          // overlap margin for gluing/taping
  } = options;

  const a4 = orientation === "landscape" ? A4_LANDSCAPE : A4_PORTRAIT;

  // Graph size scaled
  const graphW = bounds.width * scale;
  const graphH = bounds.height * scale;

  const stepW = Math.max(100, a4.contentWidthPx - overlapPx);
  const stepH = Math.max(100, a4.contentHeightPx - overlapPx);

  const cols = Math.max(1, Math.ceil((graphW - overlapPx) / stepW));
  const rows = Math.max(1, Math.ceil((graphH - overlapPx) / stepH));

  const totalPages = rows * cols;

  const pages = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pageId = `${r + 1}${colToAlphabet(c)}`; // e.g. "1a", "1b", "2a"
      const pageIdUpper = `${r + 1}${colToAlphabet(c).toUpperCase()}`;

      // Coordinates of the top-left corner of this page in graph space (unscaled)
      const graphX = (c * stepW) / scale + bounds.minX;
      const graphY = (r * stepH) / scale + bounds.minY;

      pages.push({
        row: r + 1,
        col: c,
        colLetter: colToAlphabet(c),
        pageId,
        pageIdUpper,
        graphX,
        graphY,
        hasTop: r > 0,
        hasBottom: r < rows - 1,
        hasLeft: c > 0,
        hasRight: c < cols - 1,
        topNeighbor: r > 0 ? `${r}${colToAlphabet(c)}` : null,
        bottomNeighbor: r < rows - 1 ? `${r + 2}${colToAlphabet(c)}` : null,
        leftNeighbor: c > 0 ? `${r + 1}${colToAlphabet(c - 1)}` : null,
        rightNeighbor: c < cols - 1 ? `${r + 1}${colToAlphabet(c + 1)}` : null,
      });
    }
  }

  return {
    rows,
    cols,
    totalPages,
    pages,
    orientation,
    scale,
    overlapPx,
    a4,
  };
}

// Generates the print-optimized HTML for a single deed card
function renderPrintCardHtml(deed, pos, scale = 1, highlightHits = null, hasAnyActiveHighlights = false) {
  const deedInfo = deed.deedInfo || {};
  const deedNum = deedInfo.deedNumber || "(no deed no.)";
  const title = deed.title || "";
  const vol = deedInfo.volumeNumber || "—";
  const page = deedInfo.pageNumber || "—";
  const office = deedInfo.officeNumber || "—";

  const purchasers = deed.purchasers || [];
  const sellers = deed.sellers || [];
  const landParcels = deed.landParcels || [];
  const totalAreas = landParcels.map((lp) => lp.area).filter(Boolean);

  const distinctColors = highlightHits ? [...new Set(highlightHits.map((h) => h.color))] : [];
  const hasHits = distinctColors.length > 0;
  const primaryColor = distinctColors[0] || null;

  // Highlighting in-place
  const highlightedDeedNum = highlightValHtml(deedNum, "deedNo", highlightHits);
  const highlightedTitle = highlightValHtml(title, "title", highlightHits);
  const highlightedVol = highlightValHtml(vol, "volumeNo", highlightHits);
  const highlightedPage = highlightValHtml(page, "pageNo", highlightHits);
  const highlightedOffice = highlightValHtml(office, "officeNo", highlightHits);

  const purchasersHtml = purchasers
    .map(
      (p) => `
    <div style="margin-bottom: 2px;">
      <strong>${highlightValHtml(p.name, "purchaser", highlightHits) || "—"}</strong>
      ${p.fatherName ? `<span style="color: #475569; font-size: 9px;"> s/o ${highlightValHtml(p.fatherName, "purchaserFather", highlightHits)}</span>` : ""}
    </div>`
    )
    .join("");

  const sellersHtml = sellers
    .map(
      (s) => `
    <div style="margin-bottom: 2px;">
      <strong>${highlightValHtml(s.name, "seller", highlightHits) || "—"}</strong>
      ${s.fatherName ? `<span style="color: #475569; font-size: 9px;"> s/o ${highlightValHtml(s.fatherName, "sellerFather", highlightHits)}</span>` : ""}
    </div>`
    )
    .join("");

  const parcelsHtml = landParcels
    .map(
      (lp) => {
        const highlightedMouja = highlightValHtml(lp.mouja, "mouja", highlightHits);
        const highlightedSheet = highlightValHtml(lp.sheetNo, "sheetNo", highlightHits);
        const highlightedArea = highlightValHtml(lp.area, "area", highlightHits);
        const khatiyasHtml = (lp.khatiyas || [])
          .map((k) => highlightValHtml(k.number, "khatiyaNo", highlightHits))
          .filter(Boolean)
          .join(", ");

        const plotsHtml = (lp.plots || [])
          .map(
            (pl) => `
          <tr>
            <td style="padding: 1px 4px; border: 1px solid #cbd5e1; font-weight: 600;">${highlightValHtml(pl.rs, "plotNoRS", highlightHits) || "—"}</td>
            <td style="padding: 1px 4px; border: 1px solid #cbd5e1;">${highlightValHtml(pl.lr, "plotNoLR", highlightHits) || "—"}</td>
            <td style="padding: 1px 4px; border: 1px solid #cbd5e1;">${highlightValHtml(pl.area, "area", highlightHits) || "—"}</td>
          </tr>`
          )
          .join("");

        return `
        <div style="border-top: 1px dashed #cbd5e1; padding-top: 3px; margin-top: 3px; font-size: 9.5px;">
          <div style="display: flex; justify-content: space-between;">
            <span><strong>${highlightedMouja || "—"}</strong>${lp.sheetNo ? ` (Sheet ${highlightedSheet})` : ""}</span>
            ${lp.area ? `<span style="font-weight: 600; color: #166534;">${highlightedArea}</span>` : ""}
          </div>
          ${khatiyasHtml ? `<div style="font-size: 9px; color: #475569;">Khatiyas: ${khatiyasHtml}</div>` : ""}
          ${
            (lp.plots || []).length > 0
              ? `<table style="width: 100%; border-collapse: collapse; margin-top: 2px; font-size: 8.5px;">
                  <tr style="background: #f1f5f9; font-weight: 600;">
                    <td style="padding: 1px 4px; border: 1px solid #cbd5e1;">RS</td>
                    <td style="padding: 1px 4px; border: 1px solid #cbd5e1;">LR</td>
                    <td style="padding: 1px 4px; border: 1px solid #cbd5e1;">Area</td>
                  </tr>
                  ${plotsHtml}
                </table>`
              : ""
          }
        </div>`;
      }
    )
    .join("");

  // Card outline & background style
  let cardBorder = "1.5px solid #0f172a";
  let cardBg = "#ffffff";
  let cardOpacity = "1";

  if (hasHits) {
    cardBorder = `2.5px solid ${primaryColor}`;
    cardBg = "#fffdf7";
  } else if (hasAnyActiveHighlights) {
    cardBorder = "1px solid #94a3b8";
    cardOpacity = "0.85";
  }

  // Summary badge hits at bottom if any
  const hitPillsHtml = hasHits
    ? `<div style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; border-top: 1px solid #e2e8f0; padding-top: 3px;">
        ${highlightHits
          .slice(0, 4)
          .map(
            (h) => `
          <span style="font-size: 8px; font-weight: 700; color: #111; background: ${h.color}35; border: 1px solid ${h.color}; border-radius: 3px; padding: 0 4px;">
            ● ${escapeHtml(h.fieldLabel)}: ${escapeHtml(h.displayValue)}
          </span>`
          )
          .join("")}
      </div>`
    : "";

  return `
    <div class="card" style="position: absolute; left: ${pos.x}px; top: ${pos.y}px; width: 420px; box-sizing: border-box; background: ${cardBg}; border: ${cardBorder}; border-radius: 6px; padding: 8px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #111; box-shadow: 1px 2px 4px rgba(0,0,0,0.06); opacity: ${cardOpacity};">
      <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1.5px solid #222; padding-bottom: 3px; margin-bottom: 4px;">
        <div>
          <span style="font-family: Georgia, serif; font-size: 13.5px; font-weight: 700; color: #000;">Deed No. ${highlightedDeedNum}</span>
          ${title ? `<div style="font-size: 9.5px; color: #555; font-style: italic;">${highlightedTitle}</div>` : ""}
        </div>
        ${totalAreas.length > 0 ? `<span style="font-size: 10px; font-weight: 700; background: #e6f4ea; border: 1px solid #a8dab5; color: #137333; padding: 1px 5px; border-radius: 3px;">${totalAreas.join(" + ")}</span>` : ""}
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3px 4px; margin-bottom: 4px; font-size: 9px;">
        <div><span style="color: #666; font-size: 8px; text-transform: uppercase; display: block;">Deed</span><strong>${highlightedDeedNum}</strong></div>
        <div><span style="color: #666; font-size: 8px; text-transform: uppercase; display: block;">Vol</span><strong>${highlightedVol}</strong></div>
        <div><span style="color: #666; font-size: 8px; text-transform: uppercase; display: block;">Pg</span><strong>${highlightedPage}</strong></div>
        <div><span style="color: #666; font-size: 8px; text-transform: uppercase; display: block;">Office</span><strong>${highlightedOffice}</strong></div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10px; margin-bottom: 4px;">
        <div style="background: #fafafa; border: 1px solid #eee; border-radius: 3px; padding: 4px;">
          <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #0284c7; border-bottom: 1px solid #e0e0e0; margin-bottom: 2px; padding-bottom: 1px;">To (Purchasers)</div>
          ${purchasersHtml || `<span style="color: #888; font-size: 9px;">—</span>`}
        </div>
        <div style="background: #fafafa; border: 1px solid #eee; border-radius: 3px; padding: 4px;">
          <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #c2410c; border-bottom: 1px solid #e0e0e0; margin-bottom: 2px; padding-bottom: 1px;">From (Sellers)</div>
          ${sellersHtml || `<span style="color: #888; font-size: 9px;">—</span>`}
        </div>
      </div>

      ${parcelsHtml ? `<div style="background: #fafafa; border: 1px solid #eee; border-radius: 3px; padding: 4px;">${parcelsHtml}</div>` : ""}
      ${hitPillsHtml}
    </div>
  `;
}

// Master printer function that generates the multi-page tiled printout and calls window.print()
export function printTiledPoster(deeds, relationships, workspaceName, options = {}) {
  const {
    orientation = "portrait",
    scale = 1,
    overlapPx = 25,
    positions: customPositions = null,
    highlightMap = null,
    activeLayers = [],
  } = options;

  if (!deeds || deeds.length === 0) {
    alert("No deeds in this workspace to print.");
    return;
  }

  const allKeys = deeds.map((d) => String(d._id));
  const graphEdges = relationships.map((r) => ({
    sourceKey: String(r.sourceDeedId),
    targetKey: String(r.targetDeedId),
    areaTransferred: r.areaTransferred,
    _id: r._id,
  }));

  const layerById = computeLayers(allKeys, graphEdges);
  const fallbackPositions = computePositions(allKeys, layerById, {
    nodeW: 420,
    nodeH: 180,
    colGap: 60,
    rowGap: 90,
    padding: 50,
    direction: "vertical",
  });

  const getPos = (d) => {
    const key = String(d._id);
    if (customPositions?.get(key)) return customPositions.get(key);
    if (d.position) return d.position;
    return fallbackPositions.positions.get(key) || { x: 50, y: 50 };
  };

  // Calculate actual bounding box of cards
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  deeds.forEach((d) => {
    const pos = getPos(d);
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + 420);

    // Dynamic height estimation based on deed details
    const plotsCount = (d.landParcels || []).reduce((sum, lp) => sum + (lp.plots?.length || 0), 0);
    const estH = 170 + plotsCount * 18 + (d.landParcels?.length || 0) * 22;
    maxY = Math.max(maxY, pos.y + estH);
  });

  const bounds = {
    minX: Math.max(0, minX - 30),
    minY: Math.max(0, minY - 30),
    width: Math.max(fallbackPositions.width, maxX - minX + 60),
    height: Math.max(fallbackPositions.height, maxY - minY + 60),
  };

  const grid = computePosterGrid(bounds, { orientation, scale, overlapPx });
  const a4 = grid.a4;
  const hasAnyActiveHighlights = activeLayers.length > 0;

  // Build SVG wires for all edges
  const wiresHtml = graphEdges
    .map((e) => {
      const srcDeed = deeds.find((d) => String(d._id) === e.sourceKey);
      const tgtDeed = deeds.find((d) => String(d._id) === e.targetKey);
      if (!srcDeed || !tgtDeed) return "";
      const srcPos = getPos(srcDeed);
      const tgtPos = getPos(tgtDeed);

      const x1 = srcPos.x + 210;
      const y1 = srcPos.y + 190; // estimated bottom anchor
      const x2 = tgtPos.x + 210;
      const y2 = tgtPos.y;
      const midY = (y1 + y2) / 2;

      return `
        <g>
          <path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="#0f172a" stroke-width="2" marker-end="url(#arrow)" />
          ${e.areaTransferred ? `<rect x="${(x1 + x2) / 2 - 25}" y="${midY - 14}" width="50" height="15" rx="3" fill="#fff" stroke="#94a3b8" stroke-width="1"/><text x="${(x1 + x2) / 2}" y="${midY - 3}" font-size="9" font-family="-apple-system, sans-serif" font-weight="bold" fill="#0f172a" text-anchor="middle">${escapeHtml(e.areaTransferred)}</text>` : ""}
        </g>
      `;
    })
    .join("");

  // Build full content container
  const fullContentHtml = `
    <div style="position: absolute; left: 0; top: 0; width: ${bounds.width}px; height: ${bounds.height}px; transform: scale(${scale}); transform-origin: 0 0;">
      <svg width="${bounds.width}" height="${bounds.height}" style="position: absolute; left: 0; top: 0; pointer-events: none; z-index: 1;">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#0f172a" />
          </marker>
        </defs>
        ${wiresHtml}
      </svg>
      ${deeds
        .map((d) => {
          const key = String(d._id);
          const hits = highlightMap?.get(key) || null;
          return renderPrintCardHtml(d, getPos(d), scale, hits, hasAnyActiveHighlights);
        })
        .join("")}
    </div>
  `;

  // Search criteria tags summary for header
  const searchSummaryHtml = activeLayers.length > 0
    ? `<div style="font-size: 8.5px; color: #475569; display: flex; gap: 4px; align-items: center;">
        <span>Highlights:</span>
        ${activeLayers
          .map(
            (l) => `<span style="background: ${l.color}25; border: 1px solid ${l.color}; color: #111; padding: 0 4px; border-radius: 2px; font-weight: 600;">${escapeHtml(l.field)}: "${escapeHtml(l.value)}"</span>`
          )
          .join("")}
      </div>`
    : "";

  // Build each A4 sheet
  const pagesHtml = grid.pages
    .map((page) => {
      // Offset required to align this tile's viewport
      const offsetX = -(page.graphX - bounds.minX) * scale;
      const offsetY = -(page.graphY - bounds.minY) * scale;

      // Small assembly map matrix
      const matrixMap = `
        <span class="mini-grid" title="Sheet ${page.pageIdUpper} of ${grid.totalPages}">
          ${grid.pages
            .map(
              (p) => `<span class="cell ${p.pageId === page.pageId ? "current" : ""}">${p.pageId}</span>`
            )
            .join("")}
        </span>
      `;

      return `
        <div class="sheet sheet-${page.pageId}">
          <!-- Sheet Header -->
          <div class="sheet-header">
            <div>
              <div class="sheet-title">
                <strong>${escapeHtml(workspaceName || "Workspace")}</strong> — Deed Lineage Poster
              </div>
              ${searchSummaryHtml}
            </div>
            <div class="sheet-nav">
              <span class="page-badge">SHEET ${page.pageIdUpper}</span>
              <span class="page-meta">Row ${page.row}, Col ${page.colLetter.toUpperCase()} (${grid.rows}×${grid.cols} = ${grid.totalPages} sheets)</span>
              ${matrixMap}
            </div>
          </div>

          <!-- Neighbor Alignment Labels on Margin -->
          ${page.hasTop ? `<div class="edge-indicator edge-top">▲ ATTACH TO [${page.topNeighbor}] (Row ${page.row - 1})</div>` : ""}
          ${page.hasBottom ? `<div class="edge-indicator edge-bottom">▼ ATTACH TO [${page.bottomNeighbor}] (Row ${page.row + 1})</div>` : ""}
          ${page.hasLeft ? `<div class="edge-indicator edge-left">◄ ATTACH TO [${page.leftNeighbor}]</div>` : ""}
          ${page.hasRight ? `<div class="edge-indicator edge-right">ATTACH TO [${page.rightNeighbor}] ►</div>` : ""}

          <!-- Corner Crosshairs for Millimeter Alignment -->
          <div class="crosshair ch-tl">+</div>
          <div class="crosshair ch-tr">+</div>
          <div class="crosshair ch-bl">+</div>
          <div class="crosshair ch-br">+</div>

          <!-- Content Viewport -->
          <div class="sheet-viewport" style="width: ${a4.contentWidthPx}px; height: ${a4.contentHeightPx}px;">
            <div class="content-shift" style="position: absolute; left: ${offsetX}px; top: ${offsetY}px; width: ${bounds.width * scale}px; height: ${bounds.height * scale}px;">
              ${fullContentHtml}
            </div>

            <!-- Overlap glue strips with cut guides -->
            ${
              page.hasRight
                ? `<div class="glue-tab glue-tab-right" style="position: absolute; top: 0; right: 0; width: ${overlapPx}px; height: 100%; border-left: 1.5px dashed #64748b; background: rgba(226, 232, 240, 0.35); pointer-events: none; z-index: 10; display: flex; align-items: center; justify-content: center;">
                    <span style="writing-mode: vertical-rl; font-size: 7.5px; font-family: monospace; color: #475569; letter-spacing: 1px; font-weight: 700;">GLUE / OVERLAP UNDER [${page.rightNeighbor}] ►</span>
                  </div>`
                : ""
            }
            ${
              page.hasBottom
                ? `<div class="glue-tab glue-tab-bottom" style="position: absolute; bottom: 0; left: 0; width: 100%; height: ${overlapPx}px; border-top: 1.5px dashed #64748b; background: rgba(226, 232, 240, 0.35); pointer-events: none; z-index: 10; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 7.5px; font-family: monospace; color: #475569; letter-spacing: 1px; font-weight: 700;">▼ GLUE TAB: OVERLAP UNDER [${page.bottomNeighbor}]</span>
                  </div>`
                : ""
            }
          </div>

          <!-- Sheet Footer with Assembly Guide -->
          <div class="sheet-footer">
            <span class="footer-left">DeedTracker · Assembly Guide: Match [+] crosshairs and overlap tabs</span>
            <span class="footer-right">Sheet <strong>[${page.pageIdUpper}]</strong> · Row ${page.row}, Col ${page.colLetter.toUpperCase()}</span>
          </div>
        </div>
      `;
    })
    .join("\n");

  const printDocumentHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(workspaceName)} - A4 Tiled Poster (${grid.rows}x${grid.cols} Sheets)</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: #f1f5f9;
            color: #111;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @page {
            size: A4 ${orientation};
            margin: 0;
          }

          .sheet {
            width: ${orientation === "landscape" ? "297mm" : "210mm"};
            height: ${orientation === "landscape" ? "210mm" : "297mm"};
            padding: ${a4.paddingMm}mm;
            box-sizing: border-box;
            position: relative;
            page-break-after: always;
            page-break-inside: avoid;
            break-after: page;
            break-inside: avoid;
            background: #fff;
            margin: 20px auto;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }

          .sheet:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }

          @media print {
            body {
              background: #fff;
              margin: 0;
              padding: 0;
            }
            .sheet {
              box-shadow: none;
              margin: 0;
              width: ${orientation === "landscape" ? "297mm" : "210mm"};
              height: ${orientation === "landscape" ? "210mm" : "297mm"};
            }
          }

          .sheet-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1.5px solid #0f172a;
            padding-bottom: 3px;
            margin-bottom: 4px;
            font-size: 11px;
            height: 28px;
          }

          .sheet-title {
            font-size: 11px;
            color: #0f172a;
            line-height: 1.2;
          }

          .sheet-nav {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .page-badge {
            background: #0f172a;
            color: #fff;
            font-weight: 800;
            font-size: 11.5px;
            font-family: monospace;
            padding: 2px 7px;
            border-radius: 4px;
            letter-spacing: 0.5px;
          }

          .page-meta {
            font-size: 9.5px;
            color: #64748b;
          }

          .mini-grid {
            display: inline-grid;
            grid-template-columns: repeat(${grid.cols}, 14px);
            gap: 1px;
            background: #cbd5e1;
            border: 1px solid #64748b;
            padding: 1px;
            border-radius: 2px;
          }

          .mini-grid .cell {
            font-size: 7px;
            font-family: monospace;
            text-align: center;
            background: #fff;
            color: #475569;
            line-height: 11px;
          }

          .mini-grid .cell.current {
            background: #0f172a;
            color: #fff;
            font-weight: bold;
          }

          .sheet-viewport {
            overflow: hidden;
            position: relative;
            background: #fff;
            border: 1px solid #cbd5e1;
          }

          @media print {
            .sheet-viewport {
              border: 1px solid #cbd5e1;
            }
          }

          .crosshair {
            position: absolute;
            font-size: 14px;
            font-weight: bold;
            font-family: monospace;
            color: #475569;
            line-height: 1;
            z-index: 20;
          }
          .ch-tl { top: 32px; left: 6px; }
          .ch-tr { top: 32px; right: 6px; }
          .ch-bl { bottom: 24px; left: 6px; }
          .ch-br { bottom: 24px; right: 6px; }

          .edge-indicator {
            position: absolute;
            font-size: 8px;
            font-family: monospace;
            font-weight: 700;
            color: #334155;
            z-index: 15;
            background: rgba(255, 255, 255, 0.95);
            padding: 1px 5px;
            border-radius: 2px;
          }
          .edge-top { top: 33px; left: 50%; transform: translateX(-50%); border-bottom: 1px dashed #64748b; }
          .edge-bottom { bottom: 24px; left: 50%; transform: translateX(-50%); border-top: 1px dashed #64748b; }
          .edge-left { top: 50%; left: 4px; transform: translateY(-50%) rotate(-90deg); border-bottom: 1px dashed #64748b; }
          .edge-right { top: 50%; right: 4px; transform: translateY(-50%) rotate(90deg); border-bottom: 1px dashed #64748b; }

          .sheet-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #cbd5e1;
            padding-top: 3px;
            margin-top: 3px;
            font-size: 8.5px;
            color: #64748b;
            height: 18px;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=920,height=850");
  if (!win) {
    alert("Please allow pop-ups in your browser to print the tiled A4 poster.");
    return;
  }

  win.document.write(printDocumentHtml);
  win.document.close();
  setTimeout(() => win.print(), 500);
}
