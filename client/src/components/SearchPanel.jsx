import { useState } from "react";
import { api } from "../api";

const TOPICS = [
  { value: "all", label: "All fields" },
  { value: "purchaser", label: "Purchaser" },
  { value: "seller", label: "Seller" },
  { value: "deedNo", label: "Deed No." },
  { value: "volumeNo", label: "Volume No." },
  { value: "pageNo", label: "Page No." },
  { value: "officeNo", label: "Office No." },
  { value: "mouja", label: "Mouja" },
  { value: "sheetNo", label: "Sheet No." },
  { value: "khatiyaNo", label: "Khatiya No." },
  { value: "plotNoRS", label: "Plot No. (RS)" },
  { value: "plotNoLR", label: "Plot No. (LR)" },
];

function deedLabel(deed) {
  const num = deed.deedInfo?.deedNumber || "(no deed no.)";
  const buyer = deed.purchasers?.[0]?.name || "";
  return buyer ? `${num} - ${buyer}` : num;
}

export default function SearchPanel({ workspace, onlyThisWorkspace = true }) {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("all");
  const [scopeWorkspace, setScopeWorkspace] = useState(onlyThisWorkspace);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const runSearch = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await api.search(q.trim(), topic, scopeWorkspace ? workspace._id : undefined);
      setResults(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <form onSubmit={runSearch} className="flex flex-wrap gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="flex-1 border rounded px-3 py-2"
        />
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="border rounded px-2 py-2"
        >
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={scopeWorkspace}
            onChange={(e) => setScopeWorkspace(e.target.checked)}
          />
          This workspace only
        </label>
        <button className="bg-slate-900 text-white px-4 py-2 rounded">Search</button>
      </form>

      {loading && <p>Searching…</p>}
      {results && results.length === 0 && <p className="text-slate-500">No matches.</p>}
      {results && results.length > 0 && (
        <ul className="space-y-2">
          {results.map(({ deed, parents, children }) => (
            <li key={deed._id} className="bg-white border rounded p-3">
              <p className="font-medium">{deedLabel(deed)}</p>
              <p className="text-xs text-slate-500">
                Mouja: {deed.landParcels?.map((lp) => lp.mouja).filter(Boolean).join(", ") || "—"}
              </p>
              {parents.length > 0 && (
                <p className="text-xs text-slate-500">{parents.length} parent deed(s)</p>
              )}
              {children.length > 0 && (
                <p className="text-xs text-slate-500">{children.length} child deed(s)</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
