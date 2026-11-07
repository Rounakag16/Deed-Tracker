import { isValueMatch } from "../utils/highlightSearch";

// DeedCard.jsx - Displays the complete details of a deed directly
// inside the card on the visual graph canvas, with precise in-place
// highlighting on matching values.
export default function DeedCard({
  deed,
  isDraft,
  isSelected,
  parentCount = 0,
  childCount = 0,
  highlightHits = null,
}) {
  const deedInfo = deed.deedInfo || {};
  const summary = deedInfo.deedNumber || (isDraft ? "(unsaved deed)" : "(no deed no.)");
  const title = deed.title;
  const vol = deedInfo.volumeNumber;
  const page = deedInfo.pageNumber;
  const office = deedInfo.officeNumber;

  const purchasers = deed.purchasers || [];
  const sellers = deed.sellers || [];
  const landParcels = deed.landParcels || [];

  const totalAreas = landParcels.map((lp) => lp.area).filter(Boolean);
  const hasConnections = parentCount > 0 || childCount > 0;

  // Track distinct highlight colors
  const distinctColors = highlightHits ? [...new Set(highlightHits.map((h) => h.color))] : [];
  const hasHighlight = distinctColors.length > 0;
  const primaryColor = distinctColors[0] || null;

  // Precise in-place highlighter:
  // Tests if `val` matches any active search layer for `fieldKey`.
  // If matched, highlights the exact matching value or substring with the layer's color.
  const highlightVal = (val, fieldKey) => {
    if (!val) return null;
    const str = String(val).trim();
    if (!str) return null;

    if (!highlightHits || highlightHits.length === 0) return str;

    // Find the hit that matches this field
    const hit = highlightHits.find((h) => {
      if (h.fieldKey === fieldKey) {
        return isValueMatch(str, h.layerValue, h.exact);
      }
      // Aliases
      if (fieldKey === "purchaser" && (h.fieldKey === "purchaser" || h.fieldKey === "purchaserName")) {
        return isValueMatch(str, h.layerValue, h.exact);
      }
      if (fieldKey === "seller" && (h.fieldKey === "seller" || h.fieldKey === "sellerName")) {
        return isValueMatch(str, h.layerValue, h.exact);
      }
      return false;
    });

    if (!hit) return str;

    const query = String(hit.layerValue || "").trim();
    const color = hit.color;

    // If query is a substring of the text, highlight just the substring
    if (query) {
      const lowerStr = str.toLowerCase();
      const lowerQuery = query.toLowerCase();
      const idx = lowerStr.indexOf(lowerQuery);

      if (idx !== -1) {
        const before = str.slice(0, idx);
        const match = str.slice(idx, idx + query.length);
        const after = str.slice(idx + query.length);
        return (
          <span>
            {before}
            <span
              className="font-bold px-1.5 py-0.5 rounded shadow-sm inline-block"
              style={{
                backgroundColor: `${color}35`,
                color: color,
                border: `1.5px solid ${color}90`,
                boxShadow: `0 0 10px ${color}40`,
              }}
            >
              {match}
            </span>
            {after}
          </span>
        );
      }
    }

    // Full match (handles normalized matches like "ADSR-RAJ" matching "ADSR RAJ")
    return (
      <span
        className="font-bold px-1.5 py-0.5 rounded shadow-sm inline-block"
        style={{
          backgroundColor: `${color}35`,
          color: color,
          border: `1.5px solid ${color}90`,
          boxShadow: `0 0 10px ${color}40`,
        }}
      >
        {str}
      </span>
    );
  };

  // Bar color for default / draft / selection
  const defaultBarColor = isSelected
    ? "before:bg-verdigris"
    : isDraft
    ? "before:bg-brass"
    : "before:bg-ink-faint";

  // Card border and glow matching the search highlight
  let cardStyle = {};
  if (isSelected) {
    // Selection has verdigris styling
  } else if (hasHighlight) {
    if (distinctColors.length === 1) {
      cardStyle = {
        borderColor: primaryColor,
        boxShadow: `0 0 14px ${primaryColor}40, 0 4px 6px -1px rgba(0, 0, 0, 0.25)`,
      };
    } else {
      cardStyle = {
        borderColor: primaryColor,
        boxShadow: `0 0 16px ${primaryColor}35, 0 0 8px ${distinctColors[1]}30`,
      };
    }
  }

  return (
    <div
      className={`relative w-[420px] border rounded-xl bg-surface shadow-md p-4 pl-5 select-none transition-all duration-300 hover:-translate-y-1 hover:shadow-xl before:content-[''] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-r-md ${
        hasHighlight ? "" : defaultBarColor
      } ${
        isSelected
          ? "border-verdigris ring-1 ring-verdigris/50 shadow-lg scale-[1.01]"
          : hasHighlight
          ? ""
          : "border-border"
      }`}
      style={cardStyle}
    >
      {/* Left indicator strip for multiple search highlights */}
      {hasHighlight && !isSelected && (
        <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-md flex flex-col overflow-hidden">
          {distinctColors.map((c, i) => (
            <div key={i} className="flex-1 w-full" style={{ backgroundColor: c }} />
          ))}
        </div>
      )}

      {/* 1. Header: Deed Number + Reference Title + Area badge + Lineage counts */}
      <div className="flex justify-between items-start mb-2 pb-1.5 border-b border-border/80">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold font-serif text-ink text-base truncate">
              Deed No. {highlightVal(summary, "deedNo")}
            </h3>
            {isDraft && (
              <span className="text-brass text-xs font-sans font-normal px-1.5 py-0.2 bg-brass/10 rounded border border-brass/20">
                (unsaved)
              </span>
            )}
          </div>

          {title && (
            <p className="text-xs text-ink-muted truncate mt-0.5 font-sans">
              <span className="text-ink-faint mr-1">Ref:</span>
              <span className="italic">{highlightVal(title, "title")}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasConnections && (
            <span className="text-[10px] text-ink-faint bg-surface-raised border border-border rounded px-1.5 py-0.5 font-mono">
              {parentCount > 0 && <span title={`${parentCount} source deed(s)`}>↑{parentCount}</span>}
              {parentCount > 0 && childCount > 0 && " "}
              {childCount > 0 && <span title={`${childCount} derived deed(s)`}>↓{childCount}</span>}
            </span>
          )}
          {totalAreas.length > 0 && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: "rgba(79, 154, 140, 0.12)",
                color: "#4f9a8c",
                border: "1px solid rgba(79, 154, 140, 0.25)",
              }}
            >
              {totalAreas.join(" + ")}
            </span>
          )}
        </div>
      </div>

      {/* 2. Registration Details Grid */}
      <div className="grid grid-cols-4 gap-1.5 bg-canvas/70 border border-border/80 rounded-lg p-2 text-xs mb-2.5">
        <div>
          <span className="text-[9px] uppercase font-semibold text-ink-faint block">Deed No.</span>
          <span className="font-mono text-ink text-[11px] truncate block">
            {highlightVal(deedInfo.deedNumber, "deedNo") || "—"}
          </span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-semibold text-ink-faint block">Vol. No.</span>
          <span className="font-mono text-ink text-[11px] truncate block">
            {highlightVal(vol, "volumeNo") || "—"}
          </span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-semibold text-ink-faint block">Page No.</span>
          <span className="font-mono text-ink text-[11px] truncate block">
            {highlightVal(page, "pageNo") || "—"}
          </span>
        </div>
        <div>
          <span className="text-[9px] uppercase font-semibold text-ink-faint block">Office</span>
          <span className="font-mono text-ink text-[11px] truncate block" title={office || ""}>
            {highlightVal(office, "officeNo") || "—"}
          </span>
        </div>
      </div>

      {/* 3. Parties: Purchasers (To) and Sellers (From) */}
      <div className="grid grid-cols-2 gap-3 text-xs mb-2.5">
        {/* Purchasers (To) */}
        <div className="bg-canvas/40 border border-border/70 rounded-lg p-2 space-y-1">
          <div className="text-[10px] uppercase font-semibold text-ink-faint pb-1 border-b border-border/60 flex items-center justify-between">
            <span>To (Purchasers)</span>
            <span className="font-mono text-[9px] text-verdigris">{purchasers.length}</span>
          </div>
          <div className="space-y-1.5 max-h-28 overflow-y-auto">
            {purchasers.length > 0 ? (
              purchasers.map((p, idx) => (
                <div key={idx} className="text-[11px] leading-tight">
                  <div className="font-medium text-ink">
                    {highlightVal(p.name, "purchaser") || "—"}
                  </div>
                  {p.fatherName && (
                    <div className="text-[10px] text-ink-muted">
                      <span className="text-ink-faint">s/o </span>
                      {highlightVal(p.fatherName, "purchaserFather")}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <span className="text-ink-faint italic text-[11px]">—</span>
            )}
          </div>
        </div>

        {/* Sellers (From) */}
        <div className="bg-canvas/40 border border-border/70 rounded-lg p-2 space-y-1">
          <div className="text-[10px] uppercase font-semibold text-ink-faint pb-1 border-b border-border/60 flex items-center justify-between">
            <span>From (Sellers)</span>
            <span className="font-mono text-[9px] text-brass">{sellers.length}</span>
          </div>
          <div className="space-y-1.5 max-h-28 overflow-y-auto">
            {sellers.length > 0 ? (
              sellers.map((s, idx) => (
                <div key={idx} className="text-[11px] leading-tight">
                  <div className="font-medium text-ink">
                    {highlightVal(s.name, "seller") || "—"}
                  </div>
                  {s.fatherName && (
                    <div className="text-[10px] text-ink-muted">
                      <span className="text-ink-faint">s/o </span>
                      {highlightVal(s.fatherName, "sellerFather")}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <span className="text-ink-faint italic text-[11px]">—</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Land Parcels & Plots Breakdown */}
      {landParcels.length > 0 && (
        <div className="space-y-2 mb-1">
          <div className="text-[10px] uppercase font-semibold text-ink-faint pb-0.5 border-b border-border/60 flex items-center justify-between">
            <span>Land Parcels &amp; Plots</span>
            <span className="font-mono text-[9px]">{landParcels.length} parcel(s)</span>
          </div>

          <div className="space-y-2">
            {landParcels.map((lp, idx) => (
              <div
                key={idx}
                className="bg-canvas/50 border border-border/70 rounded-lg p-2 text-xs space-y-1.5"
              >
                {/* Parcel Location & Area */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1 text-ink-muted font-medium truncate">
                    <svg className="w-3 h-3 text-ink-faint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-ink">{highlightVal(lp.mouja, "mouja") || "—"}</span>
                    {lp.sheetNo && (
                      <span className="text-ink-faint text-[10px]">
                        (Sheet {highlightVal(lp.sheetNo, "sheetNo")})
                      </span>
                    )}
                  </div>
                  {lp.area && (
                    <span className="font-mono text-[10px] text-verdigris bg-verdigris/10 px-1.5 py-0.2 rounded">
                      {highlightVal(lp.area, "area")}
                    </span>
                  )}
                </div>

                {/* Khatiyas */}
                {(lp.khatiyas || []).length > 0 && (
                  <div className="text-[10px] text-ink-faint flex items-center gap-1 flex-wrap">
                    <span className="font-semibold uppercase tracking-wider text-[9px]">Khatiyas:</span>
                    {(lp.khatiyas || []).map((k, ki) => (
                      <span
                        key={ki}
                        className="bg-surface-raised border border-border/60 text-ink px-1 rounded font-mono text-[10px]"
                      >
                        {highlightVal(k.number, "khatiyaNo")}
                      </span>
                    ))}
                  </div>
                )}

                {/* Plots Table (RS / LR / Area) */}
                {(lp.plots || []).length > 0 && (
                  <div className="border border-border/60 rounded overflow-hidden">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-surface-raised text-ink-faint text-[9px] uppercase font-semibold">
                        <tr>
                          <th className="py-0.5 px-2">Plot (RS)</th>
                          <th className="py-0.5 px-2">Plot (LR)</th>
                          <th className="py-0.5 px-2">Plot Area</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-mono">
                        {(lp.plots || []).map((pl, pi) => (
                          <tr key={pi} className="hover:bg-surface-raised/40">
                            <td className="py-0.5 px-2 text-ink">
                              {highlightVal(pl.rs, "plotNoRS") || "—"}
                            </td>
                            <td className="py-0.5 px-2 text-ink">
                              {highlightVal(pl.lr, "plotNoLR") || "—"}
                            </td>
                            <td className="py-0.5 px-2 text-ink-muted">
                              {highlightVal(pl.area, "area") || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
