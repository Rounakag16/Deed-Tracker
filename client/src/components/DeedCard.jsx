// Compact on-canvas summary only - clicking a card (handled by the parent
// wrapper's drag/click logic in Canvas.jsx) selects it and opens
// DeedSidebar for full details/editing. This card no longer expands
// inline or owns any edit state itself; see DeedSidebar.jsx for that
// (moved there so opening a card's details doesn't resize the card and
// throw off the surrounding auto-layout - see PROJECT_CONTEXT.md).
export default function DeedCard({ deed, isDraft, isSelected }) {
  const summary = deed.deedInfo?.deedNumber || (isDraft ? "(unsaved deed)" : "(no deed no.)");
  const buyer = deed.purchasers?.[0]?.name;

  // brass = not yet committed (matches the same color used for pending
  // links), verdigris = currently selected, faint = default/quiet.
  const barColor = isSelected ? "before:bg-verdigris" : isDraft ? "before:bg-brass" : "before:bg-ink-faint";

  return (
    // Width must stay in sync with Canvas.jsx's NODE_W constant - the
    // wrapper positioning (dot centering, layout math) assumes this card is
    // exactly that wide.
    <div
      className={`relative w-[400px] border border-border rounded-lg bg-surface shadow-sm p-3 pl-4 select-none before:content-[''] before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-[2.5px] before:rounded ${barColor} ${
        isSelected ? "border-verdigris ring-1 ring-verdigris" : ""
      }`}
    >
      <p className="font-semibold font-serif text-ink truncate">
        {summary} {isDraft && <span className="text-brass text-xs font-sans font-normal">(unsaved)</span>}
      </p>
      {buyer && <p className="text-xs text-ink-muted truncate mt-0.5">Buyer: {buyer}</p>}
    </div>
  );
}
