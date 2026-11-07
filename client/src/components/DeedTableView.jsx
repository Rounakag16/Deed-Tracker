import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

const COLS = [
  { key: "deedNumber",  label: "Deed No."   },
  { key: "volume",      label: "Vol."        },
  { key: "page",        label: "Page"        },
  { key: "office",      label: "Office"      },
  { key: "purchasers",  label: "Purchasers"  },
  { key: "sellers",     label: "Sellers"     },
  { key: "mouja",       label: "Mouja"       },
  { key: "area",        label: "Area"        },
  { key: "date",        label: "Date"        },
  { key: "parents",     label: "? Parents"   },
  { key: "children",    label: "? Children"  },
];

function flatten(deed, relationships) {
  const parents  = relationships.filter((r) => String(r.targetDeedId) === deed._id).length;
  const children = relationships.filter((r) => String(r.sourceDeedId) === deed._id).length;
  return {
    _id:        deed._id,
    deedNumber: deed.deedInfo?.deedNumber   || "",
    volume:     deed.deedInfo?.volumeNumber || "",
    page:       deed.deedInfo?.pageNumber   || "",
    office:     deed.deedInfo?.officeNumber || "",
    purchasers: (deed.purchasers || []).map((p) => p.name).filter(Boolean).join(", "),
    sellers:    (deed.sellers    || []).map((s) => s.name).filter(Boolean).join(", "),
    mouja:      [...new Set((deed.landParcels || []).map((lp) => lp.mouja).filter(Boolean))].join(", "),
    area:       (deed.landParcels || []).map((lp) => lp.area).filter(Boolean).join(" + "),
    date:       deed.deedInfo?.registrationDate || "",
    parents,
    children,
    _raw: deed,
  };
}

function Highlight({ text, query }) {
  if (!query || !text) return <>{text || "—"}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text || "—"}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-brass/30 text-ink rounded-sm not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function DeedTableView({ workspace, onSelectDeed }) {
  const [deeds, setDeeds]                 = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [query, setQuery]                 = useState("");
  const [sortCol, setSortCol]             = useState("deedNumber");
  const [sortAsc, setSortAsc]             = useState(true);
  const [selectedId, setSelectedId]       = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.listDeeds(workspace._id),
      api.listRelationships(workspace._id),
    ]).then(([ds, rs]) => {
      setDeeds(ds);
      setRelationships(rs);
      setLoading(false);
    });
  }, [workspace._id]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const rows = useMemo(() => {
    const flat = deeds.map((d) => flatten(d, relationships));
    const q = query.trim().toLowerCase();
    const filtered = q
      ? flat.filter((r) =>
          Object.entries(r)
            .filter(([k]) => !k.startsWith("_") && k !== "parents" && k !== "children")
            .some(([, v]) => String(v).toLowerCase().includes(q))
        )
      : flat;

    return [...filtered].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const cmp =
        typeof av === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortAsc ? cmp : -cmp;
    });
  }, [deeds, relationships, query, sortCol, sortAsc]);

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(true); }
  };

  const handleRowClick = (row) => {
    setSelectedId(row._id === selectedId ? null : row._id);
    if (onSelectDeed) onSelectDeed(row._raw);
  };

  const q = query.trim();

  return (
    <div className="h-full flex flex-col bg-canvas text-ink">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border bg-surface shrink-0">
        <h2 className="text-xl font-semibold font-serif">{workspace.name}</h2>
        <span className="text-xs text-ink-faint bg-surface-raised border border-border rounded px-2 py-0.5 font-mono">
          {rows.length} deed{rows.length !== 1 ? "s" : ""}
        </span>
        <div className="flex-1" />
        <div className="relative flex items-center">
          <svg className="absolute left-2.5 w-3.5 h-3.5 text-ink-faint pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Filter all columns… (Ctrl+F)"
            className="pl-8 pr-8 py-1.5 text-sm bg-canvas border border-border-strong rounded-lg text-ink placeholder:text-ink-faint focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass/40 w-64 transition-all"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2 text-ink-faint hover:text-ink text-xs p-0.5">?</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-ink-faint text-sm gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Loading deeds…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-faint gap-2">
            <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm">{q ? `No deeds match "${q}"` : "No deeds in this workspace yet."}</span>
          </div>
        ) : (
          <table className="w-full text-sm border-separate border-spacing-0" style={{ minWidth: "1100px" }}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-6 px-2 py-2.5 bg-surface border-b border-border" />
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-faint bg-surface border-b border-border cursor-pointer select-none whitespace-nowrap hover:text-ink hover:bg-surface-raised transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortCol === col.key ? (
                        <span className="text-brass text-[10px]">{sortAsc ? "?" : "?"}</span>
                      ) : (
                        <span className="text-[10px] text-ink-faint/30">?</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isSelected = selectedId === row._id;
                const rowBg = isSelected
                  ? "bg-verdigris/10"
                  : idx % 2 === 0
                  ? "bg-canvas hover:bg-surface/50"
                  : "bg-surface/25 hover:bg-surface/50";
                return (
                  <tr
                    key={row._id}
                    onClick={() => handleRowClick(row)}
                    className={`cursor-pointer transition-colors group ${rowBg}`}
                  >
                    {/* Row index */}
                    <td className="px-2 py-2 border-b border-border/40 text-center text-[10px] text-ink-faint/50 font-mono select-none">
                      {idx + 1}
                    </td>
                    <td className={`px-3 py-2.5 border-b border-border/40 font-mono font-semibold text-xs whitespace-nowrap ${isSelected ? "text-verdigris" : "text-ink"}`}>
                      <Highlight text={row.deedNumber || "—"} query={q} />
                    </td>
                    <td className="px-3 py-2.5 border-b border-border/40 text-ink-muted text-xs font-mono whitespace-nowrap">
                      <Highlight text={row.volume || "—"} query={q} />
                    </td>
                    <td className="px-3 py-2.5 border-b border-border/40 text-ink-muted text-xs font-mono whitespace-nowrap">
                      <Highlight text={row.page || "—"} query={q} />
                    </td>
                    <td className="px-3 py-2.5 border-b border-border/40 text-ink-muted text-xs whitespace-nowrap">
                      <Highlight text={row.office || "—"} query={q} />
                    </td>
                    <td className="px-3 py-2.5 border-b border-border/40 text-ink text-xs max-w-[180px] truncate">
                      <Highlight text={row.purchasers || "—"} query={q} />
                    </td>
                    <td className="px-3 py-2.5 border-b border-border/40 text-ink-muted text-xs max-w-[180px] truncate">
                      <Highlight text={row.sellers || "—"} query={q} />
                    </td>
                    <td className="px-3 py-2.5 border-b border-border/40 text-ink-muted text-xs whitespace-nowrap">
                      <Highlight text={row.mouja || "—"} query={q} />
                    </td>
                    <td className="px-3 py-2.5 border-b border-border/40 text-verdigris text-xs font-medium whitespace-nowrap">
                      <Highlight text={row.area || "—"} query={q} />
                    </td>
                    <td className="px-3 py-2.5 border-b border-border/40 text-ink-faint text-xs whitespace-nowrap">
                      {row.date || "—"}
                    </td>
                    <td className="px-3 py-2.5 border-b border-border/40 text-center text-xs">
                      {row.parents > 0 ? (
                        <span className="font-mono text-ink-faint text-[11px]" title={`${row.parents} source deed(s)`}>?{row.parents}</span>
                      ) : <span className="text-ink-faint/20">—</span>}
                    </td>
                    <td className="px-3 py-2.5 border-b border-border/40 text-center text-xs">
                      {row.children > 0 ? (
                        <span className="font-mono text-brass text-[11px]" title={`${row.children} derived deed(s)`}>?{row.children}</span>
                      ) : <span className="text-ink-faint/20">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-1.5 border-t border-border bg-surface text-xs text-ink-faint">
        <span>{rows.length} of {deeds.length} deed{deeds.length !== 1 ? "s" : ""}</span>
        {q && <span className="text-brass">Filtered: "{q}"</span>}
        <div className="flex-1" />
        <span className="opacity-60">Click a row to jump to its lineage</span>
      </div>
    </div>
  );
}
