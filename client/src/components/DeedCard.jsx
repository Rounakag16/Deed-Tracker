// Compact on-canvas summary only - clicking a card (handled by the parent
// wrapper's drag/click logic in Canvas.jsx) selects it and opens
// DeedSidebar for full details/editing. This card no longer expands
// inline or owns any edit state itself; see DeedSidebar.jsx for that
// (moved there so opening a card's details doesn't resize the card and
// throw off the surrounding auto-layout - see PROJECT_CONTEXT.md).
export default function DeedCard({ deed, isDraft, isSelected, parentCount = 0, childCount = 0 }) {
  const summary = deed.deedInfo?.deedNumber || (isDraft ? "(unsaved deed)" : "(no deed no.)");
  const buyer = deed.purchasers?.[0]?.name;
  const seller = deed.sellers?.[0]?.name;
  const vol = deed.deedInfo?.volumeNumber;
  const page = deed.deedInfo?.pageNumber;
  const office = deed.deedInfo?.officeNumber;
  const regParts = [vol && `Vol. ${vol}`, page && `Pg. ${page}`, office && office].filter(Boolean);

  const moujas = [...new Set(deed.landParcels?.map(lp => lp.mouja).filter(Boolean))];
  const areas = deed.landParcels?.map(lp => lp.area).filter(Boolean);
  const hasConnections = parentCount > 0 || childCount > 0;

  // brass = not yet committed, verdigris = currently selected, faint = default/quiet.
  const barColor = isSelected ? "before:bg-verdigris" : isDraft ? "before:bg-brass" : "before:bg-ink-faint";

  return (
    <div
      className={`relative w-[400px] border rounded-xl bg-surface shadow-md p-4 pl-5 select-none transition-all duration-300 hover:-translate-y-1 hover:shadow-xl before:content-[''] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-r-md ${barColor} ${
        isSelected ? "border-verdigris ring-1 ring-verdigris/50 shadow-lg scale-[1.01]" : "border-border"
      }`}
    >
      <div className="flex justify-between items-start mb-1">
        <h3 className="font-semibold font-serif text-ink text-base truncate pr-2">
          {summary} {isDraft && <span className="text-brass text-xs font-sans font-normal ml-1 px-1.5 py-0.5 bg-brass/10 rounded">(unsaved)</span>}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasConnections && (
            <span className="text-[10px] text-ink-faint bg-surface-raised border border-border rounded px-1.5 py-0.5 font-mono">
              {parentCount > 0 && <span title={`${parentCount} source deed(s)`}>↑{parentCount}</span>}
              {parentCount > 0 && childCount > 0 && " "}
              {childCount > 0 && <span title={`${childCount} derived deed(s)`}>↓{childCount}</span>}
            </span>
          )}
          {areas.length > 0 && (
            <span className="text-xs font-medium text-verdigris bg-verdigris/10 px-2 py-0.5 rounded-full">
              {areas.join(" + ")}
            </span>
          )}
        </div>
      </div>
      {regParts.length > 0 && (
        <p className="text-[11px] text-ink-faint mb-1 truncate">{regParts.join(" / ")}</p>
      )}
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
        <div className="truncate">
          <span className="text-ink-faint mr-1">To:</span>
          <span className="text-ink-muted">{buyer || "—"}</span>
        </div>
        <div className="truncate">
          <span className="text-ink-faint mr-1">From:</span>
          <span className="text-ink-muted">{seller || "—"}</span>
        </div>
      </div>

      {moujas.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border-strong flex items-center text-xs text-ink-muted">
          <svg className="w-3.5 h-3.5 mr-1.5 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">{moujas.join(", ")}</span>
        </div>
      )}
    </div>
  );
}
