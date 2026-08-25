# DeedTracker (MERN)

Track the lineage of land deeds as a graph: deeds can converge (multiple source
deeds combine into one) or diverge (one deed splits into several later deeds),
grouped into per-area **workspaces**.

## Structure

```
server/   Express + MongoDB (Mongoose) API
client/   React + Vite + Tailwind frontend
```

## Setup

### 1. MongoDB
Use a local MongoDB instance or a free MongoDB Atlas cluster. You just need a
connection string.

### 2. Server
```bash
cd server
cp .env.example .env   # fill in MONGODB_URI
npm install
npm run dev
```
Runs on http://localhost:4000

### 3. Client
```bash
cd client
npm install
npm run dev
```
Runs on http://localhost:5173, proxies /api to the server.

## Data model

- **Workspace** — one dedicated area/land tract. Holds many deeds.
- **Deed** — same fields as before (purchasers, sellers, deedInfo, landParcels
  with khatiyas/plots), plus `workspaceId`.
- **Relationship** — a directed edge `{ workspaceId, sourceDeedId, targetDeedId,
  areaTransferred, note }` meaning "targetDeed derives from sourceDeed". A deed
  can be the source or target of any number of edges, which is what lets a
  deed converge from several parents or diverge into several children.
  "Siblings" are just deeds that share the same source edge — no separate
  edge type needed for that.

## Workflow

Everything after this initial scaffold will be delivered to you as a `.diff`
file. To apply one:

```bash
git apply the-file-you-got.diff
git add -A
git commit -m "describe the change"
```

If a diff fails to apply cleanly (usually because you've hand-edited a file
it touches), paste the error back and I'll regenerate it against your current
version.
