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
    title: "New Deed",
    purchasers: [blankPerson()],
    sellers: [blankPerson()],
    deedInfo: { deedNumber: "", volumeNumber: "", pageNumber: "", officeNumber: "" },
    landParcels: [blankParcel()],
  };
}

const inputCls =
  "border border-border-strong bg-canvas text-ink placeholder:text-ink-faint rounded px-2 py-1 text-sm focus:outline-none focus:border-brass";
const removeCls = "text-brick text-xs px-1 disabled:opacity-40 disabled:cursor-not-allowed";
const addLinkCls = "text-xs text-brass hover:underline";
const sectionLabelCls = "text-xs font-semibold text-ink-faint mb-1";

function PersonListEditor({ label, people, onChange }) {
  const update = (i, field, value) => {
    const next = people.map((p, idx) => (idx === i ? { ...p, [field]: value } : p));
    onChange(next);
  };
  return (
    <div>
      <p className={sectionLabelCls}>{label}</p>
      {people.map((p, i) => (
        <div key={i} className="flex gap-2 mb-1">
          <input
            className={`flex-1 ${inputCls}`}
            placeholder="Name"
            value={p.name}
            onChange={(e) => update(i, "name", e.target.value)}
          />
          <input
            className={`flex-1 ${inputCls}`}
            placeholder="Father's name"
            value={p.fatherName}
            onChange={(e) => update(i, "fatherName", e.target.value)}
          />
          <button
            type="button"
            className={removeCls}
            disabled={people.length <= 1}
            onClick={() => onChange(people.filter((_, idx) => idx !== i))}
          >
            ✕
          </button>
        </div>
      ))}
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
    <div>
      <p className={sectionLabelCls}>Land Parcels</p>
      {parcels.map((parcel, i) => (
        <div key={i} className="border border-border rounded p-2 mb-2 bg-surface-raised">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input
              className={inputCls}
              placeholder="Area"
              value={parcel.area}
              onChange={(e) => updateParcel(i, "area", e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="Mouja"
              value={parcel.mouja}
              onChange={(e) => updateParcel(i, "mouja", e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="Sheet No."
              value={parcel.sheetNo}
              onChange={(e) => updateParcel(i, "sheetNo", e.target.value)}
            />
          </div>

          <p className="text-xs text-ink-faint">Khatiya No.(s)</p>
          {parcel.khatiyas.map((k, ki) => (
            <div key={ki} className="flex gap-2 mb-1">
              <input
                className={`flex-1 ${inputCls}`}
                placeholder="Khatiya No."
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
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className={`${addLinkCls} mb-2`}
            onClick={() => updateKhatiyas(i, [...parcel.khatiyas, blankKhatiya()])}
          >
            + Add Khatiya
          </button>

          <p className="text-xs text-ink-faint">Plots (RS / LR / Area)</p>
          {parcel.plots.map((pl, pi) => (
            <div key={pi} className="flex gap-2 mb-1">
              <input
                className={`flex-1 ${inputCls}`}
                placeholder="RS"
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
                placeholder="LR"
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
                placeholder="Area"
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
                className={removeCls}
                disabled={parcel.plots.length <= 1}
                onClick={() => updatePlots(i, parcel.plots.filter((_, idx) => idx !== pi))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className={addLinkCls}
            onClick={() => updatePlots(i, [...parcel.plots, blankPlot()])}
          >
            + Add Plot
          </button>

          <div className="text-right mt-2">
            <button
              type="button"
              className="text-brick text-xs hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={parcels.length <= 1}
              onClick={() => onChange(parcels.filter((_, idx) => idx !== i))}
            >
              Remove parcel
            </button>
          </div>
        </div>
      ))}
      <button type="button" className={addLinkCls} onClick={() => onChange([...parcels, blankParcel()])}>
        + Add Land Parcel
      </button>
    </div>
  );
}

export default function DeedForm({ deed, onChange }) {
  const set = (field, value) => onChange({ ...deed, [field]: value });
  const setDeedInfo = (field, value) =>
    onChange({ ...deed, deedInfo: { ...deed.deedInfo, [field]: value } });

  return (
    <div className="space-y-3">
      <input
        className={`w-full ${inputCls} font-medium`}
        placeholder="Deed title (for your own reference)"
        value={deed.title}
        onChange={(e) => set("title", e.target.value)}
      />

      <div className="grid grid-cols-2 gap-2">
        <input
          className={inputCls}
          placeholder="Deed No."
          value={deed.deedInfo.deedNumber}
          onChange={(e) => setDeedInfo("deedNumber", e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Volume No."
          value={deed.deedInfo.volumeNumber}
          onChange={(e) => setDeedInfo("volumeNumber", e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Page No."
          value={deed.deedInfo.pageNumber}
          onChange={(e) => setDeedInfo("pageNumber", e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Office No."
          value={deed.deedInfo.officeNumber}
          onChange={(e) => setDeedInfo("officeNumber", e.target.value)}
        />
      </div>

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
      <LandParcelEditor parcels={deed.landParcels} onChange={(v) => set("landParcels", v)} />
    </div>
  );
}
