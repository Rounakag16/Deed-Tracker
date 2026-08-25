const express = require("express");
const Relationship = require("../models/Relationship");

const router = express.Router({ mergeParams: true });

// GET /api/workspaces/:workspaceId/relationships
router.get("/", async (req, res) => {
  const { workspaceId } = req.params;
  const relationships = await Relationship.find({ workspaceId });
  res.json(relationships);
});

// POST /api/workspaces/:workspaceId/relationships
// Body: { relationships: [ { sourceDeedId, targetDeedId, areaTransferred, note }, ... ] }
// Supports creating several edges at once - "connect mode" batches its picks
// and sends them all when you hit Save.
router.post("/", async (req, res) => {
  const { workspaceId } = req.params;
  const incoming = Array.isArray(req.body.relationships)
    ? req.body.relationships
    : [req.body];

  const bad = incoming.find((r) => r.sourceDeedId === r.targetDeedId);
  if (bad) {
    return res.status(400).json({ error: "A deed cannot derive from itself" });
  }

  const docs = incoming.map((r) => ({ ...r, workspaceId }));
  try {
    const created = await Relationship.insertMany(docs, { ordered: false });
    res.status(201).json(created);
  } catch (err) {
    // Duplicate edges (same source/target pair) are silently ignored;
    // surface anything else.
    if (err.code === 11000 || err.writeErrors) {
      res.status(207).json({ warning: "Some edges already existed and were skipped" });
    } else {
      throw err;
    }
  }
});

// DELETE /api/workspaces/:workspaceId/relationships/:relationshipId
router.delete("/:relationshipId", async (req, res) => {
  const { workspaceId, relationshipId } = req.params;
  const rel = await Relationship.findOneAndDelete({ _id: relationshipId, workspaceId });
  if (!rel) return res.status(404).json({ error: "Relationship not found" });
  res.json({ success: true });
});

module.exports = router;
