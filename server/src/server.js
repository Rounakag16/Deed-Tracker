require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./utils/db");

const workspacesRouter = require("./routes/workspaces");
const deedsRouter = require("./routes/deeds");
const relationshipsRouter = require("./routes/relationships");
const searchRouter = require("./routes/search");
const exportRouter = require("./routes/export");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use("/api/workspaces", workspacesRouter);
app.use("/api/workspaces/:workspaceId/deeds", deedsRouter);
app.use("/api/workspaces/:workspaceId/relationships", relationshipsRouter);
app.use("/api/workspaces/:workspaceId/export", exportRouter);
app.use("/api/search", searchRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Generic error handler so a thrown error doesn't crash the process.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
