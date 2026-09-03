const express = require("express");
const Deed = require("../models/Deed");
const Relationship = require("../models/Relationship");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router({ mergeParams: true });

// GET /api/workspaces/:workspaceId/deeds
// Deliberately NOT paginated: the canvas/lineage view needs the complete
// deed graph for a workspace to lay out and wire correctly - paginating
// this list would silently hide deeds from the DAG. Pagination lives on
// the workspace list and search instead, where partial results are safe.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const deeds = await Deed.find({ workspaceId }).sort({ createdAt: 1 });
    res.json(deeds);
  })
);

// POST /api/workspaces/:workspaceId/deeds
// Body: { deeds: [ {...deedFields} , ... ] }  -- supports creating several at once
// (e.g. "add 5 deeds" on the canvas before wiring them together)
// insertMany is run ordered:true, which validates every document up front:
// if any deed fails validation (e.g. missing deed number), none of the
// batch is inserted - matches the all-or-nothing batching Canvas.jsx
// already assumes when it maps created[i] back onto draftDeeds by index.
// The ValidationError is caught by the generic error handler as a 400.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const incoming = Array.isArray(req.body.deeds) ? req.body.deeds : [req.body];
    const docs = incoming.map((d) => ({ ...d, workspaceId }));
    const created = await Deed.insertMany(docs, { ordered: true });
    res.status(201).json(created);
  })
);

// PUT /api/workspaces/:workspaceId/deeds/:deedId
// The client already strips _id/__v/createdAt/updatedAt/workspaceId before
// sending an update (see Canvas.jsx's onSave), but that's a client-side
// courtesy, not a guarantee - strip them here too so a stray/old client
// build can't move a deed to a different workspace or overwrite its id
// via the request body.
router.put(
  "/:deedId",
  asyncHandler(async (req, res) => {
    const { workspaceId, deedId } = req.params;
    const { _id, __v, createdAt, updatedAt, workspaceId: _workspaceId, ...fields } = req.body;
    const deed = await Deed.findOneAndUpdate(
      { _id: deedId, workspaceId },
      { $set: fields },
      { new: true, runValidators: true, context: "query" }
    );
    if (!deed) return res.status(404).json({ error: "Deed not found" });
    res.json(deed);
  })
);

// DELETE /api/workspaces/:workspaceId/deeds/:deedId  (cascades to its edges)
router.delete(
  "/:deedId",
  asyncHandler(async (req, res) => {
    const { workspaceId, deedId } = req.params;
    const deed = await Deed.findOneAndDelete({ _id: deedId, workspaceId });
    if (!deed) return res.status(404).json({ error: "Deed not found" });
    await Relationship.deleteMany({
      workspaceId,
      $or: [{ sourceDeedId: deedId }, { targetDeedId: deedId }],
    });
    res.json({ success: true });
  })
);

module.exports = router;
