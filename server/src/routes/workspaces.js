const express = require("express");
const Workspace = require("../models/Workspace");
const Deed = require("../models/Deed");
const Relationship = require("../models/Relationship");

const router = express.Router();

// GET /api/workspaces
router.get("/", async (req, res) => {
  const workspaces = await Workspace.find().sort({ createdAt: -1 });
  res.json(workspaces);
});

// GET /api/workspaces/:id
router.get("/:id", async (req, res) => {
  const workspace = await Workspace.findById(req.params.id);
  if (!workspace) return res.status(404).json({ error: "Workspace not found" });
  res.json(workspace);
});

// POST /api/workspaces
router.post("/", async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Workspace name is required" });
  }
  const workspace = await Workspace.create({ name: name.trim(), description });
  res.status(201).json(workspace);
});

// PATCH /api/workspaces/:id
router.patch("/:id", async (req, res) => {
  const { name, description } = req.body;
  const workspace = await Workspace.findByIdAndUpdate(
    req.params.id,
    { ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description } : {}) },
    { new: true }
  );
  if (!workspace) return res.status(404).json({ error: "Workspace not found" });
  res.json(workspace);
});

// DELETE /api/workspaces/:id  (cascades to its deeds + relationships)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const workspace = await Workspace.findByIdAndDelete(id);
  if (!workspace) return res.status(404).json({ error: "Workspace not found" });
  await Relationship.deleteMany({ workspaceId: id });
  await Deed.deleteMany({ workspaceId: id });
  res.json({ success: true });
});

module.exports = router;
