const express = require("express");
const Deed = require("../models/Deed");
const Relationship = require("../models/Relationship");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Map a search "topic" to the Mongo fields it should match against.
const TOPIC_FIELDS = {
  purchaser: ["purchasers.name", "purchasers.fatherName"],
  purchaserName: ["purchasers.name"],
  purchaserFather: ["purchasers.fatherName"],
  seller: ["sellers.name", "sellers.fatherName"],
  sellerName: ["sellers.name"],
  sellerFather: ["sellers.fatherName"],
  deedNo: ["deedInfo.deedNumber"],
  volumeNo: ["deedInfo.volumeNumber"],
  pageNo: ["deedInfo.pageNumber"],
  officeNo: ["deedInfo.officeNumber"],
  mouja: ["landParcels.mouja"],
  sheetNo: ["landParcels.sheetNo"],
  khatiyaNo: ["landParcels.khatiyas.number"],
  plotNoRS: ["landParcels.plots.rs"],
  plotNoLR: ["landParcels.plots.lr"],
  area: ["landParcels.area", "landParcels.plots.area"],
  title: ["title"],
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

// Field-scoped search builds a RegExp directly from user input. Land-record
// values routinely contain regex metacharacters that are meaningful
// characters in this domain, not markup - a khatiya number like "45(a)", a
// decimal area like "2.5", a plot note like "3+4" - so escape them before
// constructing the RegExp. Without this, searching for any of the above
// either throws (unbalanced "(" is an invalid pattern -> 500) or silently
// matches more than intended ("." matching any character).
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/search?q=...&topic=all|purchaser|seller|...&workspaceId=optional&page=1&limit=25
//
// topic=all uses Mongo's $text operator against the compound text index
// defined on Deed.js (previously this index existed but was unused - every
// search, including "all fields", ran per-field regex $or instead).
// Results are sorted by text relevance score.
//
// A scoped topic (e.g. topic=deedNo) still uses regex $or on just that
// field: Mongo's $text can't be restricted to a subset of an index's
// fields at query time, so field-scoped search can't use the text index -
// regex is the correct tool there, not a leftover.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q, topic = "all", workspaceId, exact } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ error: "Query param 'q' is required" });
    }
    if (topic !== "all" && !TOPIC_FIELDS[topic]) {
      return res.status(400).json({ error: `Unknown topic '${topic}'` });
    }

    const isExact = exact === "true" || exact === true;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));

    const filter = {};
    if (workspaceId) filter.workspaceId = workspaceId;

    let query;
    let total;
    if (topic === "all") {
      filter.$text = { $search: q.trim() };
      query = Deed.find(filter, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } })
        .skip((page - 1) * limit)
        .limit(limit);
      total = await Deed.countDocuments(filter);
    } else {
      const pattern = isExact ? `^${escapeRegex(q.trim())}$` : escapeRegex(q.trim());
      const regex = new RegExp(pattern, "i");
      filter.$or = TOPIC_FIELDS[topic].map((field) => ({ [field]: regex }));
      query = Deed.find(filter)
        .skip((page - 1) * limit)
        .limit(limit);
      total = await Deed.countDocuments(filter);
    }

    const deeds = await query;

    // Attach immediate lineage (parents/children) for context with populated details.
    const deedIds = deeds.map((d) => d._id);
    const relatedEdges = await Relationship.find({
      $or: [{ sourceDeedId: { $in: deedIds } }, { targetDeedId: { $in: deedIds } }],
    })
      .populate("sourceDeedId", "deedInfo title purchasers sellers")
      .populate("targetDeedId", "deedInfo title purchasers sellers");

    const results = deeds.map((deed) => {
      const parents = relatedEdges
        .filter((e) => {
          const targetId = e.targetDeedId?._id ? String(e.targetDeedId._id) : String(e.targetDeedId);
          return targetId === String(deed._id);
        })
        .map((e) => {
          const src = e.sourceDeedId;
          return {
            _id: src?._id || src,
            deedNumber: src?.deedInfo?.deedNumber || "(no deed no.)",
            title: src?.title || "",
            areaTransferred: e.areaTransferred,
            note: e.note,
          };
        });

      const children = relatedEdges
        .filter((e) => {
          const sourceId = e.sourceDeedId?._id ? String(e.sourceDeedId._id) : String(e.sourceDeedId);
          return sourceId === String(deed._id);
        })
        .map((e) => {
          const tgt = e.targetDeedId;
          return {
            _id: tgt?._id || tgt,
            deedNumber: tgt?.deedInfo?.deedNumber || "(no deed no.)",
            title: tgt?.title || "",
            areaTransferred: e.areaTransferred,
            note: e.note,
          };
        });

      return { deed, parents, children };
    });

    res.json({ results, total, page, limit });
  })
);

module.exports = router;
