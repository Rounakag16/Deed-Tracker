const blankPerson = () => ({ name: "", fatherName: "" });
const blankKhatiya = () => ({ number: "" });
const blankPlot = () => ({ rs: "", lr: "", area: "" });
const blankParcel = () => ({
  area: "",
  mouja: "",
  sheetNo: "",
  khatiyas: [blankKhatiya()],
  plots: [blankPlot()],
});

export function blankDeed() {
  return {
    title: "",
    purchasers: [blankPerson()],
    sellers: [blankPerson()],
    deedInfo: { deedNumber: "", volumeNumber: "", pageNumber: "", officeNumber: "" },
    landParcels: [blankParcel()],
  };
}

const inputCls =
  "w-full border border-border-strong bg-canvas hover:bg-surface/50 text-ink placeholder:text-ink-faint rounded-md px-3 py-2 text-sm focus:outline-none focus:border-verdigris focus:ring-1 focus:ring-verdigris focus:bg-canvas transition-all duration-300 shadow-sm";
const labelCls = "block text-xs font-medium text-ink-muted mb-1 uppercase tracking-wider";
const removeCls =
  "text-brick/70 hover:text-brick text-xs p-1.5 rounded-md hover:bg-brick/10 transition-all duration-300 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed";
const addLinkCls =
  "inline-flex items-center text-xs font-medium text-verdigris hover:text-verdigris/80 transition-all duration-300 active:scale-95 mt-2 bg-verdigris/10 hover:bg-verdigris/20 px-3 py-1.5 rounded-md";
const sectionLabelCls = "text-sm font-semibold text-ink mb-3 pb-1 border-b border-border";

function PersonListEditor({ label, people, onChange }) {
  const update = (i, field, value) => {
    const next = people.map((p, idx) => (idx === i ? { ...p, [field]: value } : p));
    onChange(next);
  };
  return (
    <div className="mb-6">
      <h3 className={sectionLabelCls}>{label}</h3>
      <div className="space-y-3">
        {people.map((p, i) => (
          <div key={i} className="flex items-start gap-2 group">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div>
                <input
                  className={inputCls}
                  placeholder="Name"
                  value={p.name}
                  onChange={(e) => update(i, "name", e.target.value)}
                />
              </div>
              <div>
                <input
                  className={inputCls}
                  placeholder="Father's Name"
                  value={p.fatherName}
                  onChange={(e) => update(i, "fatherName", e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              className={`mt-1 ${removeCls} opacity-0 group-hover:opacity-100 focus:opacity-100`}
              disabled={people.length <= 1}
              onClick={() => onChange(people.filter((_, idx) => idx !== i))}
              title="Remove person"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button type="button" className={addLinkCls} onClick={() => onChange([...people, blankPerson()])}>
        + Add {label.slice(0, -1)}
      </button>
    </div>
  );
}

function LandParcelEditor({ parcels, onChange }) {
  const updateParcel = (i, field, value) => {
    onChange(parcels.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };
  const updateKhatiyas = (i, khatiyas) => updateParcel(i, "khatiyas", khatiyas);
  const updatePlots = (i, plots) => updateParcel(i, "plots", plots);

  return (
    <div className="mb-6">
      <h3 className={sectionLabelCls}>Land Parcels</h3>
      <div className="space-y-4">
        {parcels.map((parcel, i) => (
          <div key={i} className="border border-border-strong rounded-lg p-4 bg-surface-raised relative group">
            {parcels.length > 1 && (
              <button
                type="button"
                className={`absolute top-2 right-2 ${removeCls}`}
                onClick={() => onChange(parcels.filter((_, idx) => idx !== i))}
                title="Remove parcel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
            
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className={labelCls}>Total Area</label>
                <input
                  className={inputCls}
                  placeholder="e.g. 10 Acres"
                  value={parcel.area}
                  onChange={(e) => updateParcel(i, "area", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Mouja</label>
                <input
                  className={inputCls}
                  placeholder="Mouja Name"
                  value={parcel.mouja}
                  onChange={(e) => updateParcel(i, "mouja", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Sheet No.</label>
                <input
                  className={inputCls}
                  placeholder="Sheet"
                  value={parcel.sheetNo}
                  onChange={(e) => updateParcel(i, "sheetNo", e.target.value)}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className={labelCls}>Khatiya Numbers</label>
              <div className="flex flex-wrap gap-2">
                {parcel.khatiyas.map((k, ki) => (
                  <div key={ki} className="flex items-center gap-1">
                    <input
                      className={`${inputCls} w-28`}
                      placeholder="Khatiya"
                      value={k.number}
                      onChange={(e) =>
                        updateKhatiyas(
                          i,
                          parcel.khatiyas.map((kk, idx) =>
                            idx === ki ? { ...kk, number: e.target.value } : kk
                          )
                        )
                      }
                    />
                    <button
                      type="button"
                      className={removeCls}
                      disabled={parcel.khatiyas.length <= 1}
                      onClick={() =>
                        updateKhatiyas(i, parcel.khatiyas.filter((_, idx) => idx !== ki))
                      }
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="px-2 py-1.5 text-xs text-verdigris border border-verdigris/30 hover:bg-verdigris/10 rounded-md transition-colors"
                  onClick={() => updateKhatiyas(i, [...parcel.khatiyas, blankKhatiya()])}
                >
                  + Add
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls}>Plots (RS / LR / Area)</label>
              <div className="space-y-2">
                {parcel.plots.map((pl, pi) => (
                  <div key={pi} className="flex gap-2 items-center group/plot">
                    <input
                      className={`flex-1 ${inputCls}`}
                      placeholder="RS Plot"
                      value={pl.rs}
                      onChange={(e) =>
                        updatePlots(
                          i,
                          parcel.plots.map((pp, idx) =>
                            idx === pi ? { ...pp, rs: e.target.value } : pp
                          )
                        )
                      }
                    />
                    <input
                      className={`flex-1 ${inputCls}`}
                      placeholder="LR Plot"
                      value={pl.lr}
                      onChange={(e) =>
                        updatePlots(
                          i,
                          parcel.plots.map((pp, idx) =>
                            idx === pi ? { ...pp, lr: e.target.value } : pp
                          )
                        )
                      }
                    />
                    <input
                      className={`flex-1 ${inputCls}`}
                      placeholder="Plot Area"
                      value={pl.area}
                      onChange={(e) =>
                        updatePlots(
                          i,
                          parcel.plots.map((pp, idx) =>
                            idx === pi ? { ...pp, area: e.target.value } : pp
                          )
                        )
                      }
                    />
                    <button
                      type="button"
                      className={`${removeCls} opacity-0 group-hover/plot:opacity-100 focus:opacity-100`}
                      disabled={parcel.plots.length <= 1}
                      onClick={() => updatePlots(i, parcel.plots.filter((_, idx) => idx !== pi))}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={addLinkCls}
                onClick={() => updatePlots(i, [...parcel.plots, blankPlot()])}
              >
                + Add Plot
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className={addLinkCls} onClick={() => onChange([...parcels, blankParcel()])}>
        + Add New Parcel
      </button>
    </div>
  );
}

export default function DeedForm({ deed, onChange }) {
  const set = (field, value) => onChange({ ...deed, [field]: value });
  const setDeedInfo = (field, value) =>
    onChange({ ...deed, deedInfo: { ...deed.deedInfo, [field]: value } });

  return (
    <div className="space-y-6 pb-8">
      <div>
        <label className={labelCls}>Deed Title (Optional Reference)</label>
        <input
          className={`${inputCls} font-medium text-base py-2.5`}
          placeholder="e.g. Purchase from Ram Kumar"
          value={deed.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </div>

      <div className="bg-canvas border border-border rounded-lg p-4">
        <h3 className={sectionLabelCls}>Registration Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Deed No.</label>
            <input
              className={inputCls}
              placeholder="e.g. I-1234"
              value={deed.deedInfo.deedNumber}
              onChange={(e) => setDeedInfo("deedNumber", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Volume No.</label>
            <input
              className={inputCls}
              placeholder="e.g. 15"
              value={deed.deedInfo.volumeNumber}
              onChange={(e) => setDeedInfo("volumeNumber", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Page No.</label>
            <input
              className={inputCls}
              placeholder="e.g. 45-56"
              value={deed.deedInfo.pageNumber}
              onChange={(e) => setDeedInfo("pageNumber", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Office No.</label>
            <input
              className={inputCls}
              placeholder="e.g. ADSR"
              value={deed.deedInfo.officeNumber}
              onChange={(e) => setDeedInfo("officeNumber", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-canvas border border-border rounded-lg p-4 shadow-sm">
        <PersonListEditor
          label="Purchasers"
          people={deed.purchasers}
          onChange={(v) => set("purchasers", v)}
        />
        <PersonListEditor
          label="Sellers"
          people={deed.sellers}
          onChange={(v) => set("sellers", v)}
        />
      </div>

      <div className="bg-canvas border border-border rounded-lg p-4 shadow-sm">
        <LandParcelEditor parcels={deed.landParcels} onChange={(v) => set("landParcels", v)} />
      </div>
    </div>
  );
}
