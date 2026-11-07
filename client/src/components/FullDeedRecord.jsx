import { printFullDeedRecord } from "../utils/print";

// Helper to highlight matching text within a string
function HighlightText({ text, query, isTargetField }) {
  if (!text) return <span className="text-ink-muted">—</span>;
  const str = String(text);
  if (!query || !query.trim() || !isTargetField) {
    return <span>{str}</span>;
  }

  const q = query.trim().toLowerCase();
  const index = str.toLowerCase().indexOf(q);
  if (index === -1) {
    return <span>{str}</span>;
  }

  const before = str.slice(0, index);
  const match = str.slice(index, index + q.length);
  const after = str.slice(index + q.length);

  return (
    <span>
      {before}
      <mark className="bg-brass/30 text-brass font-bold px-1 py-0.5 rounded border border-brass/50 shadow-sm">
        {match}
      </mark>
      {after}
    </span>
  );
}

// Complete, full-information deed record component for the Search tab.
// Displays all actual fields, parties, parcels, plots, lineage, and metadata
// in a clean, print-friendly document format.
export default function FullDeedRecord({
  deed,
  parents = [],
  children = [],
  searchQuery = "",
  searchTopic = "all",
  onSelectDeed,
}) {
  const deedInfo = deed.deedInfo || {};
  const deedNum = deedInfo.deedNumber || "(no deed no.)";
  const title = deed.title || "";
  const vol = deedInfo.volumeNumber;
  const page = deedInfo.pageNumber;
  const office = deedInfo.officeNumber;

  const purchasers = deed.purchasers || [];
  const sellers = deed.sellers || [];
  const landParcels = deed.landParcels || [];

  // Determine which fields are targets for highlighting based on the search topic
  const isFieldTarget = (fieldCategory) => {
    if (!searchQuery.trim()) return false;
    if (searchTopic === "all") return true;
    return searchTopic === fieldCategory;
  };

  const handlePrint = (e) => {
    e.stopPropagation();
    printFullDeedRecord(deed, parents, children);
  };

  return (
    <article className="bg-surface border-2 border-border-strong rounded-2xl p-6 shadow-xl text-ink transition-all hover:border-border hover:shadow-2xl space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b-2 border-border-strong">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-brass/15 text-brass font-semibold border border-brass/30">
              Complete Deed Record
            </span>
            {deed._id && (
              <span className="text-[11px] font-mono text-ink-faint">
                ID: {deed._id}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-serif font-bold text-ink mt-1.5 flex items-center gap-2">
            Deed No.{" "}
            <HighlightText
              text={deedNum}
              query={searchQuery}
              isTargetField={isFieldTarget("deedNo")}
            />
          </h3>
          {title && (
            <p className="text-sm text-ink-muted mt-0.5 font-medium">
              Reference:{" "}
              <HighlightText
                text={title}
                query={searchQuery}
                isTargetField={isFieldTarget("title")}
              />
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-surface-raised hover:bg-surface border border-border-strong hover:border-ink-muted text-ink font-medium text-xs px-3.5 py-2 rounded-lg transition-all active:scale-95 shadow-sm"
            title="Print this complete deed record directly"
          >
            <svg className="w-4 h-4 text-brass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Record
          </button>

          {onSelectDeed && (
            <button
              onClick={() => onSelectDeed(deed)}
              className="flex items-center gap-1.5 bg-verdigris/15 hover:bg-verdigris/25 border border-verdigris/40 text-verdigris font-medium text-xs px-3.5 py-2 rounded-lg transition-all active:scale-95"
              title="View this deed in the lineage graph"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              View Lineage
            </button>
          )}
        </div>
      </div>

      {/* 1. Registration Details */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2.5 pb-1 border-b border-border">
          1. Registration Details
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-canvas/70 border border-border rounded-xl p-3.5">
          <div>
            <div className="text-[10px] uppercase font-semibold text-ink-faint">Deed Number</div>
            <div className="text-sm font-semibold text-ink mt-0.5">
              <HighlightText
                text={deedNum}
                query={searchQuery}
                isTargetField={isFieldTarget("deedNo")}
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-ink-faint">Volume Number</div>
            <div className="text-sm font-semibold text-ink mt-0.5">
              <HighlightText
                text={vol || "—"}
                query={searchQuery}
                isTargetField={isFieldTarget("volumeNo")}
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-ink-faint">Page Number</div>
            <div className="text-sm font-semibold text-ink mt-0.5">
              <HighlightText
                text={page || "—"}
                query={searchQuery}
                isTargetField={isFieldTarget("pageNo")}
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-ink-faint">Office Number / Sub-Registry</div>
            <div className="text-sm font-semibold text-ink mt-0.5">
              <HighlightText
                text={office || "—"}
                query={searchQuery}
                isTargetField={isFieldTarget("officeNo")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Parties: Purchasers & Sellers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Purchasers */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2.5 pb-1 border-b border-border flex items-center justify-between">
            <span>2. Purchasers (To)</span>
            <span className="text-[11px] font-mono text-ink-faint font-normal">{purchasers.length} person(s)</span>
          </h4>
          <div className="border border-border rounded-xl overflow-hidden bg-canvas/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-raised border-b border-border text-ink-muted">
                <tr>
                  <th className="py-2 px-3 font-semibold uppercase text-[10px] tracking-wider">Name</th>
                  <th className="py-2 px-3 font-semibold uppercase text-[10px] tracking-wider">Father's Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {purchasers.length > 0 ? (
                  purchasers.map((p, idx) => (
                    <tr key={idx} className="hover:bg-surface-raised/50">
                      <td className="py-2 px-3 font-medium text-ink">
                        <HighlightText
                          text={p.name}
                          query={searchQuery}
                          isTargetField={isFieldTarget("purchaser") || isFieldTarget("purchaserName")}
                        />
                      </td>
                      <td className="py-2 px-3 text-ink-muted">
                        <HighlightText
                          text={p.fatherName}
                          query={searchQuery}
                          isTargetField={isFieldTarget("purchaser") || isFieldTarget("purchaserFather")}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 text-ink-faint italic text-center">
                      No purchasers recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sellers */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2.5 pb-1 border-b border-border flex items-center justify-between">
            <span>3. Sellers (From)</span>
            <span className="text-[11px] font-mono text-ink-faint font-normal">{sellers.length} person(s)</span>
          </h4>
          <div className="border border-border rounded-xl overflow-hidden bg-canvas/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-raised border-b border-border text-ink-muted">
                <tr>
                  <th className="py-2 px-3 font-semibold uppercase text-[10px] tracking-wider">Name</th>
                  <th className="py-2 px-3 font-semibold uppercase text-[10px] tracking-wider">Father's Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sellers.length > 0 ? (
                  sellers.map((s, idx) => (
                    <tr key={idx} className="hover:bg-surface-raised/50">
                      <td className="py-2 px-3 font-medium text-ink">
                        <HighlightText
                          text={s.name}
                          query={searchQuery}
                          isTargetField={isFieldTarget("seller") || isFieldTarget("sellerName")}
                        />
                      </td>
                      <td className="py-2 px-3 text-ink-muted">
                        <HighlightText
                          text={s.fatherName}
                          query={searchQuery}
                          isTargetField={isFieldTarget("seller") || isFieldTarget("sellerFather")}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 text-ink-faint italic text-center">
                      No sellers recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. Land Parcels & Plot Information */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2.5 pb-1 border-b border-border flex items-center justify-between">
          <span>4. Land Parcels &amp; Plot Details</span>
          <span className="text-[11px] font-mono text-ink-faint font-normal">{landParcels.length} parcel(s)</span>
        </h4>

        {landParcels.length > 0 ? (
          <div className="space-y-3">
            {landParcels.map((lp, idx) => (
              <div
                key={idx}
                className="bg-canvas/60 border border-border-strong rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                  <span className="font-semibold text-brass uppercase tracking-wide text-[11px]">
                    Parcel #{idx + 1}
                  </span>
                  {lp.area && (
                    <span className="px-2 py-0.5 rounded-full bg-verdigris/15 text-verdigris text-xs font-medium">
                      Area:{" "}
                      <HighlightText
                        text={lp.area}
                        query={searchQuery}
                        isTargetField={isFieldTarget("area")}
                      />
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-ink-faint text-[10px] uppercase font-semibold block">Mouja</span>
                    <span className="font-medium text-ink">
                      <HighlightText
                        text={lp.mouja || "—"}
                        query={searchQuery}
                        isTargetField={isFieldTarget("mouja")}
                      />
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-faint text-[10px] uppercase font-semibold block">Sheet No.</span>
                    <span className="font-medium text-ink">
                      <HighlightText
                        text={lp.sheetNo || "—"}
                        query={searchQuery}
                        isTargetField={isFieldTarget("sheetNo")}
                      />
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-faint text-[10px] uppercase font-semibold block">Khatiya Numbers</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(lp.khatiyas || []).length > 0 ? (
                        lp.khatiyas.map((k, ki) => (
                          <span
                            key={ki}
                            className="bg-surface-raised border border-border px-1.5 py-0.2 rounded font-mono text-[11px] text-ink"
                          >
                            <HighlightText
                              text={k.number}
                              query={searchQuery}
                              isTargetField={isFieldTarget("khatiyaNo")}
                            />
                          </span>
                        ))
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Plots Table */}
                {(lp.plots || []).length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden mt-2">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-raised/80 border-b border-border text-ink-faint text-[10px] uppercase font-semibold">
                        <tr>
                          <th className="py-1.5 px-3">Plot (RS)</th>
                          <th className="py-1.5 px-3">Plot (LR)</th>
                          <th className="py-1.5 px-3">Plot Area</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {lp.plots.map((pl, pi) => (
                          <tr key={pi} className="hover:bg-surface-raised/40">
                            <td className="py-1.5 px-3 font-mono text-ink">
                              <HighlightText
                                text={pl.rs || "—"}
                                query={searchQuery}
                                isTargetField={isFieldTarget("plotNoRS")}
                              />
                            </td>
                            <td className="py-1.5 px-3 font-mono text-ink">
                              <HighlightText
                                text={pl.lr || "—"}
                                query={searchQuery}
                                isTargetField={isFieldTarget("plotNoLR")}
                              />
                            </td>
                            <td className="py-1.5 px-3 text-ink-muted">
                              <HighlightText
                                text={pl.area || "—"}
                                query={searchQuery}
                                isTargetField={isFieldTarget("area")}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-faint italic py-2">No land parcels recorded for this deed.</p>
        )}
      </div>

      {/* 4. Lineage & Connected Deeds */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Parents */}
        <div className="bg-canvas/40 border border-border rounded-xl p-3.5">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brass/80" />
            <span>Sourced From (Earlier Deeds): {parents.length}</span>
          </h5>
          {parents.length > 0 ? (
            <div className="space-y-1.5 text-xs">
              {parents.map((p, i) => (
                <div
                  key={i}
                  className="bg-surface border border-border rounded-lg p-2 flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-brass font-serif">
                      Deed {p.deedNumber || "(no deed no.)"}
                    </span>
                    {p.title && <span className="text-ink-faint text-[11px] ml-1.5">({p.title})</span>}
                    {p.note && <p className="text-[10px] text-ink-muted mt-0.5">{p.note}</p>}
                  </div>
                  {p.areaTransferred && (
                    <span className="text-[10px] font-medium bg-brass/10 text-brass px-2 py-0.5 rounded-full shrink-0">
                      {p.areaTransferred}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-faint italic">Root deed — no earlier source registered.</p>
          )}
        </div>

        {/* Children */}
        <div className="bg-canvas/40 border border-border rounded-xl p-3.5">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-verdigris/80" />
            <span>Derived Into (Subsequent Deeds): {children.length}</span>
          </h5>
          {children.length > 0 ? (
            <div className="space-y-1.5 text-xs">
              {children.map((c, i) => (
                <div
                  key={i}
                  className="bg-surface border border-border rounded-lg p-2 flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-verdigris font-serif">
                      Deed {c.deedNumber || "(no deed no.)"}
                    </span>
                    {c.title && <span className="text-ink-faint text-[11px] ml-1.5">({c.title})</span>}
                    {c.note && <p className="text-[10px] text-ink-muted mt-0.5">{c.note}</p>}
                  </div>
                  {c.areaTransferred && (
                    <span className="text-[10px] font-medium bg-verdigris/10 text-verdigris px-2 py-0.5 rounded-full shrink-0">
                      {c.areaTransferred}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-faint italic">No subsequent deeds derive from this one yet.</p>
          )}
        </div>
      </div>
    </article>
  );
}

