const mongoose = require("mongoose");

// Same field names/shape as the original app's createNewDeedNode(),
// just without the tree's "children" field — relationships now live
// in the separate Relationship collection.

const personSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    fatherName: { type: String, default: "" },
  },
  { _id: false }
);

const khatiyaSchema = new mongoose.Schema(
  {
    number: { type: String, default: "" },
  },
  { _id: false }
);

const plotSchema = new mongoose.Schema(
  {
    rs: { type: String, default: "" },
    lr: { type: String, default: "" },
    area: { type: String, default: "" },
  },
  { _id: false }
);

const landParcelSchema = new mongoose.Schema(
  {
    area: { type: String, default: "" },
    mouja: { type: String, default: "" },
    sheetNo: { type: String, default: "" },
    khatiyas: { type: [khatiyaSchema], default: () => [{ number: "" }] },
    plots: { type: [plotSchema], default: () => [{ rs: "", lr: "", area: "" }] },
  },
  { _id: false }
);

const deedInfoSchema = new mongoose.Schema(
  {
    deedNumber: { type: String, default: "" },
    volumeNumber: { type: String, default: "" },
    pageNumber: { type: String, default: "" },
    officeNumber: { type: String, default: "" },
  },
  { _id: false }
);

const positionSchema = new mongoose.Schema(
  { x: Number, y: Number },
  { _id: false }
);

const deedSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    title: { type: String, default: "New Deed" },
    purchasers: { type: [personSchema], default: () => [{ name: "", fatherName: "" }] },
    sellers: { type: [personSchema], default: () => [{ name: "", fatherName: "" }] },
    deedInfo: { type: deedInfoSchema, default: () => ({}) },
    landParcels: { type: [landParcelSchema], default: () => [{}] },
    // Manual canvas placement. Absent/null = not yet manually placed, so the
    // client falls back to its auto-arranged (layered) position for this deed.
    position: { type: positionSchema, default: null },
  },
  { timestamps: true }
);

// Text index across the fields people actually search by.
deedSchema.index({
  "purchasers.name": "text",
  "purchasers.fatherName": "text",
  "sellers.name": "text",
  "sellers.fatherName": "text",
  "deedInfo.deedNumber": "text",
  "deedInfo.volumeNumber": "text",
  "deedInfo.pageNumber": "text",
  "deedInfo.officeNumber": "text",
  "landParcels.mouja": "text",
  "landParcels.sheetNo": "text",
  "landParcels.khatiyas.number": "text",
  "landParcels.plots.rs": "text",
  "landParcels.plots.lr": "text",
});

module.exports = mongoose.model("Deed", deedSchema);
