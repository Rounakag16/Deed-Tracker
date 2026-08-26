const express = require("express");
const Workspace = require("../models/Workspace");
const Deed = require("../models/Deed");
const Relationship = require("../models/Relationship");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// GET /api/workspaces?page=1&limit=20
// Paginated - returns { workspaces, total, page, limit } instead of a bare
// array. (Unlike the deeds-within-a-workspace list, this one is safe to
// paginate: nothing else on screen needs "every workspace at once".)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const [workspaces, total] = await Promise.all([
      Workspace.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Workspace.countDocuments(),
    ]);
    res.json({ workspaces, total, page, limit });
  })
);

// GET /api/workspaces/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });
    res.json(workspace);
  })
);

// POST /api/workspaces
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Workspace name is required" });
    }
    const workspace = await Workspace.create({ name: name.trim(), description });
    res.status(201).json(workspace);
  })
);

// PATCH /api/workspaces/:id
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: "Workspace name cannot be blank" });
    }
    const workspace = await Workspace.findByIdAndUpdate(
      req.params.id,
      { ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description } : {}) },
      { new: true, runValidators: true }
    );
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });
    res.json(workspace);
  })
);

// DELETE /api/workspaces/:id  (cascades to its deeds + relationships)
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const workspace = await Workspace.findByIdAndDelete(id);
    if (!workspace) return res.status(404).json({ error: "Workspace not found" });
    await Relationship.deleteMany({ workspaceId: id });
    await Deed.deleteMany({ workspaceId: id });
    res.json({ success: true });
  })
);

module.exports = router;
