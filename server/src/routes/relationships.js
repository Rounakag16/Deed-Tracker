const express = require("express");
const Relationship = require("../models/Relationship");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router({ mergeParams: true });

// GET /api/workspaces/:workspaceId/relationships
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const relationships = await Relationship.find({ workspaceId });
    res.json(relationships);
  })
);

// BFS: is `target` reachable from `start` by following existing edges
// forward (source -> target)? Used to reject an edge that would close a
// multi-hop cycle (A->B->C, then someone tries to add C->A).
function hasPath(adjacency, start, target) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const node = queue.shift();
    if (node === target) return true;
    for (const next of adjacency.get(node) || []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

// POST /api/workspaces/:workspaceId/relationships
// Body: { relationships: [ { sourceDeedId, targetDeedId, areaTransferred, note }, ... ] }
// Supports creating several edges at once - "connect mode" batches its picks
// and sends them all when you hit Save.
//
// Cycle prevention: rejects any candidate edge source->target where target
// can already reach source via existing edges (that would mean source
// ends up reachable from itself once the new edge is added: A->B->...->A).
// Checked against existing saved edges AND earlier edges in the same
// batch, so a cycle introduced entirely within one batch is also caught.
// All-or-nothing: if any candidate is a self-loop or would close a cycle,
// none of the batch is inserted, so the user gets one clear error instead
// of a half-applied save.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const incoming = Array.isArray(req.body.relationships)
      ? req.body.relationships
      : [req.body];

    const selfLoop = incoming.find((r) => String(r.sourceDeedId) === String(r.targetDeedId));
    if (selfLoop) {
      return res.status(400).json({ error: "A deed cannot derive from itself" });
    }

    const existing = await Relationship.find({ workspaceId }, "sourceDeedId targetDeedId");
    const adjacency = new Map();
    const addEdge = (s, t) => {
      if (!adjacency.has(s)) adjacency.set(s, new Set());
      adjacency.get(s).add(t);
    };
    existing.forEach((r) => addEdge(String(r.sourceDeedId), String(r.targetDeedId)));

    for (const r of incoming) {
      const s = String(r.sourceDeedId);
      const t = String(r.targetDeedId);
      if (hasPath(adjacency, t, s)) {
        return res.status(400).json({
          error: `Linking ${s} → ${t} would create a cycle (a deed derived from itself through an earlier chain)`,
        });
      }
      addEdge(s, t);
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
  })
);

// DELETE /api/workspaces/:workspaceId/relationships/:relationshipId
router.delete(
  "/:relationshipId",
  asyncHandler(async (req, res) => {
    const { workspaceId, relationshipId } = req.params;
    const rel = await Relationship.findOneAndDelete({ _id: relationshipId, workspaceId });
    if (!rel) return res.status(404).json({ error: "Relationship not found" });
    res.json({ success: true });
  })
);

module.exports = router;
