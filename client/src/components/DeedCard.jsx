// Compact on-canvas summary only - clicking a card (handled by the parent
// wrapper's drag/click logic in Canvas.jsx) selects it and opens
// DeedSidebar for full details/editing. This card no longer expands
// inline or owns any edit state itself; see DeedSidebar.jsx for that
// (moved there so opening a card's details doesn't resize the card and
// throw off the surrounding auto-layout - see PROJECT_CONTEXT.md).
export default function DeedCard({ deed, isDraft, isSelected }) {
  const summary = deed.deedInfo?.deedNumber || (isDraft ? "(unsaved deed)" : "(no deed no.)");
  const buyer = deed.purchasers?.[0]?.name;

  return (
    // Width must stay in sync with Canvas.jsx's NODE_W constant - the
    // wrapper positioning (dot centering, layout math) assumes this card is
    // exactly that wide.
    <div
      className={`w-[400px] border rounded-lg bg-white shadow-sm p-3 select-none ${
        isSelected ? "border-blue-500 ring-2 ring-blue-200" : ""
      }`}
    >
      <p className="font-semibold truncate">
        {summary} {isDraft && <span className="text-amber-600 text-xs">(unsaved)</span>}
      </p>
      {buyer && <p className="text-xs text-slate-500 truncate">Buyer: {buyer}</p>}
    </div>
  );
}
