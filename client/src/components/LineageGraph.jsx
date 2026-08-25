import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

function deedLabel(deed) {
  const num = deed.deedInfo?.deedNumber || "(no deed no.)";
  const buyer = deed.purchasers?.[0]?.name || "";
  return buyer ? `${num} - ${buyer}` : num;
}

const NODE_W = 170;
const NODE_H = 56;
const COL_GAP = 90;
const ROW_GAP = 24;
const PADDING = 30;

// Longest-path layering: a node's layer is 1 + the deepest of its parents'
// layers, so converging deeds (multiple sources) always sit to the right of
// every one of their sources, and diverging deeds (multiple children) each
// get their own downstream layer.
function computeLayers(deedIds, parentsOf) {
  const layer = new Map();
  const visiting = new Set();

  function layerOf(id) {
    if (layer.has(id)) return layer.get(id);
    if (visiting.has(id)) return 0; // cycle guard - shouldn't happen, but don't hang
    visiting.add(id);
    const parents = parentsOf.get(id) || [];
    const l = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(layerOf));
    visiting.delete(id);
    layer.set(id, l);
    return l;
  }

  deedIds.forEach(layerOf);
  return layer;
}

export default function LineageGraph({ workspace }) {
  const [deeds, setDeeds] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    api.listDeeds(workspace._id).then(setDeeds);
    api.listRelationships(workspace._id).then(setRelationships);
  }, [workspace._id]);

  const { positions, edges, width, height } = useMemo(() => {
    const deedIds = deeds.map((d) => d._id);
    const parentsOf = new Map();
    const childrenOf = new Map();
    relationships.forEach((r) => {
      const s = String(r.sourceDeedId);
      const t = String(r.targetDeedId);
      if (!parentsOf.has(t)) parentsOf.set(t, []);
      parentsOf.get(t).push(s);
      if (!childrenOf.has(s)) childrenOf.set(s, []);
      childrenOf.get(s).push(t);
    });

    const layerById = computeLayers(deedIds, parentsOf);

    const byLayer = new Map();
    deedIds.forEach((id) => {
      const l = layerById.get(id) ?? 0;
      if (!byLayer.has(l)) byLayer.set(l, []);
      byLayer.get(l).push(id);
    });

    const positions = new Map();
    byLayer.forEach((ids, l) => {
      ids.forEach((id, i) => {
        positions.set(id, {
          x: PADDING + l * (NODE_W + COL_GAP),
          y: PADDING + i * (NODE_H + ROW_GAP),
        });
      });
    });

    const maxLayer = Math.max(0, ...[...byLayer.keys()]);
    const maxRows = Math.max(1, ...[...byLayer.values()].map((v) => v.length));

    const edges = relationships
      .map((r) => {
        const from = positions.get(String(r.sourceDeedId));
        const to = positions.get(String(r.targetDeedId));
        if (!from || !to) return null;
        return { ...r, from, to };
      })
      .filter(Boolean);

    return {
      positions,
      edges,
      width: PADDING * 2 + (maxLayer + 1) * NODE_W + maxLayer * COL_GAP,
      height: PADDING * 2 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP,
    };
  }, [deeds, relationships]);

  const deedById = useMemo(() => new Map(deeds.map((d) => [d._id, d])), [deeds]);

  const selectedDeed = selectedId ? deedById.get(selectedId) : null;
  const incoming = selectedId
    ? relationships.filter((r) => String(r.targetDeedId) === selectedId)
    : [];
  const outgoing = selectedId
    ? relationships.filter((r) => String(r.sourceDeedId) === selectedId)
    : [];

  if (deeds.length === 0) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <p className="text-slate-500">No deeds in this workspace yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h2 className="text-lg font-semibold mb-1">{workspace.name} — Lineage</h2>
      <p className="text-sm text-slate-500 mb-4">
        Arrows point from a source deed to the deed(s) derived from it. A deed with several
        incoming arrows converged from multiple sources; several outgoing arrows means it
        diverged into multiple later deeds. Click a deed to see its full details and lineage.
      </p>
      <div className="flex gap-4 items-start">
        <div className="bg-white border rounded overflow-auto flex-1">
          <svg width={Math.max(width, 400)} height={Math.max(height, 200)}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="#64748b" />
            </marker>
          </defs>

          {edges.map((e, i) => {
            const x1 = e.from.x + NODE_W;
            const y1 = e.from.y + NODE_H / 2;
            const x2 = e.to.x;
            const y2 = e.to.y + NODE_H / 2;
            const midX = (x1 + x2) / 2;
            const dimmed =
              hoveredId && String(e.sourceDeedId) !== hoveredId && String(e.targetDeedId) !== hoveredId;
            return (
              <g key={e._id || i} opacity={dimmed ? 0.25 : 1}>
                <path
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="1.5"
                  markerEnd="url(#arrowhead)"
                />
                {e.areaTransferred && (
                  <text x={midX} y={(y1 + y2) / 2 - 4} fontSize="10" fill="#475569" textAnchor="middle">
                    {e.areaTransferred}
                  </text>
                )}
              </g>
            );
          })}

          {deeds.map((deed) => {
            const pos = positions.get(deed._id);
            if (!pos) return null;
            const dimmed = hoveredId && hoveredId !== deed._id;
            return (
              <g
                key={deed._id}
                transform={`translate(${pos.x}, ${pos.y})`}
                opacity={dimmed ? 0.4 : 1}
                onMouseEnter={() => setHoveredId(deed._id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setSelectedId(deed._id)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx="8"
                  fill="#fff"
                  stroke={selectedId === deed._id ? "#2563eb" : "#334155"}
                  strokeWidth={selectedId === deed._id ? "2.5" : "1.5"}
                />
                <text x="10" y="22" fontSize="12" fontWeight="600" fill="#0f172a">
                  {(deedById.get(deed._id).deedInfo?.deedNumber || "(no deed no.)").slice(0, 22)}
                </text>
                <text x="10" y="40" fontSize="11" fill="#475569">
                  {(deedById.get(deed._id).purchasers?.[0]?.name || "").slice(0, 24)}
                </text>
              </g>
            );
          })}
        </svg>
        </div>

        {selectedDeed && (
          <div className="w-80 shrink-0 bg-white border rounded p-4 text-sm">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold">{deedLabel(selectedDeed)}</h3>
              <button
                className="text-slate-400 hover:text-slate-700 text-xs"
                onClick={() => setSelectedId(null)}
              >
                ✕
              </button>
            </div>

            <dl className="space-y-1 mb-3">
              <div>
                <dt className="text-xs text-slate-500">Deed No. / Volume / Page / Office</dt>
                <dd>
                  {selectedDeed.deedInfo?.deedNumber || "—"} /{" "}
                  {selectedDeed.deedInfo?.volumeNumber || "—"} /{" "}
                  {selectedDeed.deedInfo?.pageNumber || "—"} /{" "}
                  {selectedDeed.deedInfo?.officeNumber || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Purchasers</dt>
                <dd>{selectedDeed.purchasers?.map((p) => p.name).filter(Boolean).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Sellers</dt>
                <dd>{selectedDeed.sellers?.map((s) => s.name).filter(Boolean).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Mouja / Sheet No.</dt>
                <dd>
                  {selectedDeed.landParcels?.map((lp) => lp.mouja).filter(Boolean).join(", ") || "—"} /{" "}
                  {selectedDeed.landParcels?.map((lp) => lp.sheetNo).filter(Boolean).join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Total Area</dt>
                <dd>{selectedDeed.landParcels?.map((lp) => lp.area).filter(Boolean).join(", ") || "—"}</dd>
              </div>
            </dl>

            <div className="border-t pt-2 mb-2">
              <p className="text-xs font-semibold text-slate-500 mb-1">
                Sourced from ({incoming.length})
              </p>
              {incoming.length === 0 ? (
                <p className="text-xs text-slate-400">This is a root deed — no earlier source.</p>
              ) : (
                <ul className="space-y-1">
                  {incoming.map((r) => {
                    const src = deedById.get(String(r.sourceDeedId));
                    return (
                      <li key={r._id}>
                        <button
                          className="text-blue-600 hover:underline text-left"
                          onClick={() => setSelectedId(String(r.sourceDeedId))}
                        >
                          {src ? deedLabel(src) : "(deleted deed)"}
                        </button>
                        {r.areaTransferred ? ` — ${r.areaTransferred}` : ""}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t pt-2">
              <p className="text-xs font-semibold text-slate-500 mb-1">
                Derived into ({outgoing.length})
              </p>
              {outgoing.length === 0 ? (
                <p className="text-xs text-slate-400">No later deeds derive from this one yet.</p>
              ) : (
                <ul className="space-y-1">
                  {outgoing.map((r) => {
                    const tgt = deedById.get(String(r.targetDeedId));
                    return (
                      <li key={r._id}>
                        <button
                          className="text-blue-600 hover:underline text-left"
                          onClick={() => setSelectedId(String(r.targetDeedId))}
                        >
                          {tgt ? deedLabel(tgt) : "(deleted deed)"}
                        </button>
                        {r.areaTransferred ? ` — ${r.areaTransferred}` : ""}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
