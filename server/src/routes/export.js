const express = require("express");
const ExcelJS = require("exceljs");
const Deed = require("../models/Deed");
const Relationship = require("../models/Relationship");
const Workspace = require("../models/Workspace");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router({ mergeParams: true });

function deedLabel(deed) {
  const num = deed.deedInfo?.deedNumber || "(no deed no.)";
  const buyer = deed.purchasers?.[0]?.name || "";
  return buyer ? `${num} - ${buyer}` : num;
}

// Walk upstream from a deed to find every root ancestor (a deed with no
// incoming edges). A deed can have several if it converged from multiple
// sources.
function findRootAncestors(deedId, parentsByDeed, cache = new Map()) {
  if (cache.has(deedId)) return cache.get(deedId);
  const parents = parentsByDeed.get(deedId) || [];
  if (parents.length === 0) {
    cache.set(deedId, [deedId]);
    return [deedId];
  }
  const roots = new Set();
  for (const p of parents) {
    for (const r of findRootAncestors(p, parentsByDeed, cache)) roots.add(r);
  }
  const result = [...roots];
  cache.set(deedId, result);
  return result;
}

// GET /api/workspaces/:workspaceId/export
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return res.status(404).json({ error: "Workspace not found" });

  const deeds = await Deed.find({ workspaceId });
  const relationships = await Relationship.find({ workspaceId });

  const deedById = new Map(deeds.map((d) => [String(d._id), d]));
  const parentsByDeed = new Map();
  for (const rel of relationships) {
    const t = String(rel.targetDeedId);
    if (!parentsByDeed.has(t)) parentsByDeed.set(t, []);
    parentsByDeed.get(t).push(String(rel.sourceDeedId));
  }
  const rootCache = new Map();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DeedTracker";
  workbook.created = new Date();

  // ---- Sheet 1: Deeds ----
  const deedsSheet = workbook.addWorksheet("Deeds");
  deedsSheet.columns = [
    { header: "Deed No.", key: "deedNumber", width: 14 },
    { header: "Volume No.", key: "volumeNumber", width: 12 },
    { header: "Page No.", key: "pageNumber", width: 10 },
    { header: "Office No.", key: "officeNumber", width: 12 },
    { header: "Purchasers", key: "purchasers", width: 30 },
    { header: "Sellers", key: "sellers", width: 30 },
    { header: "Mouja(s)", key: "mouja", width: 20 },
    { header: "Sheet No.(s)", key: "sheetNo", width: 16 },
    { header: "Khatiya No.(s)", key: "khatiya", width: 20 },
    { header: "Plot RS", key: "plotRs", width: 16 },
    { header: "Plot LR", key: "plotLr", width: 16 },
    { header: "Total Area", key: "area", width: 14 },
    { header: "Root Ancestor Deed(s)", key: "rootAncestors", width: 30 },
  ];
  deedsSheet.getRow(1).font = { bold: true };

  for (const deed of deeds) {
    const roots = findRootAncestors(String(deed._id), parentsByDeed, rootCache)
      .filter((id) => id !== String(deed._id))
      .map((id) => deedById.get(id))
      .filter(Boolean)
      .map(deedLabel);

    deedsSheet.addRow({
      deedNumber: deed.deedInfo?.deedNumber || "",
      volumeNumber: deed.deedInfo?.volumeNumber || "",
      pageNumber: deed.deedInfo?.pageNumber || "",
      officeNumber: deed.deedInfo?.officeNumber || "",
      purchasers: (deed.purchasers || []).map((p) => p.name).filter(Boolean).join(", "),
      sellers: (deed.sellers || []).map((s) => s.name).filter(Boolean).join(", "),
      mouja: (deed.landParcels || []).map((lp) => lp.mouja).filter(Boolean).join(", "),
      sheetNo: (deed.landParcels || []).map((lp) => lp.sheetNo).filter(Boolean).join(", "),
      khatiya: (deed.landParcels || [])
        .flatMap((lp) => (lp.khatiyas || []).map((k) => k.number))
        .filter(Boolean)
        .join(", "),
      plotRs: (deed.landParcels || [])
        .flatMap((lp) => (lp.plots || []).map((p) => p.rs))
        .filter(Boolean)
        .join(", "),
      plotLr: (deed.landParcels || [])
        .flatMap((lp) => (lp.plots || []).map((p) => p.lr))
        .filter(Boolean)
        .join(", "),
      area: (deed.landParcels || []).map((lp) => lp.area).filter(Boolean).join(", "),
      rootAncestors: roots.length ? roots.join(" | ") : "(this is a root deed)",
    });
  }

  // ---- Sheet 2: Relationships ----
  const relSheet = workbook.addWorksheet("Relationships");
  relSheet.columns = [
    { header: "Source Deed (parent)", key: "source", width: 30 },
    { header: "Target Deed (derived)", key: "target", width: 30 },
    { header: "Area/Share Transferred", key: "area", width: 22 },
    { header: "Note", key: "note", width: 30 },
  ];
  relSheet.getRow(1).font = { bold: true };

  for (const rel of relationships) {
    const source = deedById.get(String(rel.sourceDeedId));
    const target = deedById.get(String(rel.targetDeedId));
    relSheet.addRow({
      source: source ? deedLabel(source) : "(deleted deed)",
      target: target ? deedLabel(target) : "(deleted deed)",
      area: rel.areaTransferred || "",
      note: rel.note || "",
    });
  }

  const filename = `${workspace.name.replace(/[^a-z0-9]/gi, "_")}_export.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  })
);

module.exports = router;
