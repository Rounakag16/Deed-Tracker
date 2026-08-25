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

function PersonListEditor({ label, people, onChange }) {
  const update = (i, field, value) => {
    const next = people.map((p, idx) => (idx === i ? { ...p, [field]: value } : p));
    onChange(next);
  };
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
      {people.map((p, i) => (
        <div key={i} className="flex gap-2 mb-1">
          <input
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="Name"
            value={p.name}
            onChange={(e) => update(i, "name", e.target.value)}
          />
          <input
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="Father's name"
            value={p.fatherName}
            onChange={(e) => update(i, "fatherName", e.target.value)}
          />
          <button
            type="button"
            className="text-red-500 text-xs px-1"
            disabled={people.length <= 1}
            onClick={() => onChange(people.filter((_, idx) => idx !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-blue-600 hover:underline"
        onClick={() => onChange([...people, blankPerson()])}
      >
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
      <p className="text-xs font-semibold text-slate-500 mb-1">Land Parcels</p>
      {parcels.map((parcel, i) => (
        <div key={i} className="border rounded p-2 mb-2 bg-slate-50">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Area"
              value={parcel.area}
              onChange={(e) => updateParcel(i, "area", e.target.value)}
            />
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Mouja"
              value={parcel.mouja}
              onChange={(e) => updateParcel(i, "mouja", e.target.value)}
            />
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Sheet No."
              value={parcel.sheetNo}
              onChange={(e) => updateParcel(i, "sheetNo", e.target.value)}
            />
          </div>

          <p className="text-xs text-slate-500">Khatiya No.(s)</p>
          {parcel.khatiyas.map((k, ki) => (
            <div key={ki} className="flex gap-2 mb-1">
              <input
                className="flex-1 border rounded px-2 py-1 text-sm"
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
                className="text-red-500 text-xs px-1"
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
            className="text-xs text-blue-600 hover:underline mb-2"
            onClick={() => updateKhatiyas(i, [...parcel.khatiyas, blankKhatiya()])}
          >
            + Add Khatiya
          </button>

          <p className="text-xs text-slate-500">Plots (RS / LR / Area)</p>
          {parcel.plots.map((pl, pi) => (
            <div key={pi} className="flex gap-2 mb-1">
              <input
                className="flex-1 border rounded px-2 py-1 text-sm"
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
                className="flex-1 border rounded px-2 py-1 text-sm"
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
                className="flex-1 border rounded px-2 py-1 text-sm"
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
                className="text-red-500 text-xs px-1"
                disabled={parcel.plots.length <= 1}
                onClick={() => updatePlots(i, parcel.plots.filter((_, idx) => idx !== pi))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline"
            onClick={() => updatePlots(i, [...parcel.plots, blankPlot()])}
          >
            + Add Plot
          </button>

          <div className="text-right mt-2">
            <button
              type="button"
              className="text-red-600 text-xs hover:underline"
              disabled={parcels.length <= 1}
              onClick={() => onChange(parcels.filter((_, idx) => idx !== i))}
            >
              Remove parcel
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-blue-600 hover:underline"
        onClick={() => onChange([...parcels, blankParcel()])}
      >
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
        className="w-full border rounded px-2 py-1 font-medium"
        placeholder="Deed title (for your own reference)"
        value={deed.title}
        onChange={(e) => set("title", e.target.value)}
      />

      <div className="grid grid-cols-2 gap-2">
        <input
          className="border rounded px-2 py-1 text-sm"
          placeholder="Deed No."
          value={deed.deedInfo.deedNumber}
          onChange={(e) => setDeedInfo("deedNumber", e.target.value)}
        />
        <input
          className="border rounded px-2 py-1 text-sm"
          placeholder="Volume No."
          value={deed.deedInfo.volumeNumber}
          onChange={(e) => setDeedInfo("volumeNumber", e.target.value)}
        />
        <input
          className="border rounded px-2 py-1 text-sm"
          placeholder="Page No."
          value={deed.deedInfo.pageNumber}
          onChange={(e) => setDeedInfo("pageNumber", e.target.value)}
        />
        <input
          className="border rounded px-2 py-1 text-sm"
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
