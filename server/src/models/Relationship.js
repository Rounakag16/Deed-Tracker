const mongoose = require("mongoose");

// Directed edge: targetDeed "derives from" sourceDeed.
// A deed can appear as sourceDeedId on many edges (diverges into several
// later deeds) and/or as targetDeedId on many edges (converges from several
// earlier deeds) - that's the whole graph model.

const relationshipSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    sourceDeedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deed",
      required: true,
      index: true,
    },
    targetDeedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deed",
      required: true,
      index: true,
    },
    areaTransferred: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

relationshipSchema.index(
  { workspaceId: 1, sourceDeedId: 1, targetDeedId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Relationship", relationshipSchema);
