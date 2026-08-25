const express = require("express");
const Deed = require("../models/Deed");
const Relationship = require("../models/Relationship");

const router = express.Router();

// Map a search "topic" to the Mongo fields it should match against.
const TOPIC_FIELDS = {
  purchaser: ["purchasers.name", "purchasers.fatherName"],
  seller: ["sellers.name", "sellers.fatherName"],
  deedNo: ["deedInfo.deedNumber"],
  volumeNo: ["deedInfo.volumeNumber"],
  pageNo: ["deedInfo.pageNumber"],
  officeNo: ["deedInfo.officeNumber"],
  mouja: ["landParcels.mouja"],
  sheetNo: ["landParcels.sheetNo"],
  khatiyaNo: ["landParcels.khatiyas.number"],
  plotNoRS: ["landParcels.plots.rs"],
  plotNoLR: ["landParcels.plots.lr"],
};

// GET /api/search?q=...&topic=all|purchaser|seller|...&workspaceId=optional
router.get("/", async (req, res) => {
  const { q, topic = "all", workspaceId } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: "Query param 'q' is required" });
  }

  const filter = {};
  if (workspaceId) filter.workspaceId = workspaceId;

  const regex = new RegExp(q.trim(), "i");
  if (topic === "all") {
    const allFields = Object.values(TOPIC_FIELDS).flat();
    filter.$or = allFields.map((field) => ({ [field]: regex }));
  } else if (TOPIC_FIELDS[topic]) {
    filter.$or = TOPIC_FIELDS[topic].map((field) => ({ [field]: regex }));
  } else {
    return res.status(400).json({ error: `Unknown topic '${topic}'` });
  }

  const deeds = await Deed.find(filter).limit(200);

  // Attach immediate lineage (parents/children) for context.
  const deedIds = deeds.map((d) => d._id);
  const relatedEdges = await Relationship.find({
    $or: [{ sourceDeedId: { $in: deedIds } }, { targetDeedId: { $in: deedIds } }],
  });

  const results = deeds.map((deed) => {
    const parents = relatedEdges
      .filter((e) => String(e.targetDeedId) === String(deed._id))
      .map((e) => e.sourceDeedId);
    const children = relatedEdges
      .filter((e) => String(e.sourceDeedId) === String(deed._id))
      .map((e) => e.targetDeedId);
    return { deed, parents, children };
  });

  res.json(results);
});

module.exports = router;
