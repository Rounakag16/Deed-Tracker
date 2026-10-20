// Shared deed label formatter — used by Canvas, SearchPanel, LineageGraph,
// and CommandPalette. Extracted here so a change to the format doesn't need
// four identical edits across the codebase (see improvement plan A3).
export function deedLabel(deed) {
  const num = deed.deedInfo?.deedNumber || "(no deed no.)";
  const buyer = deed.purchasers?.[0]?.name || "";
  return buyer ? `${num} - ${buyer}` : num;
}
