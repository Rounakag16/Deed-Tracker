import { useState } from "react";
import DeedForm from "./DeedForm";

export default function DeedCard({
  deed,
  isDraft,
  isSelectedForConnect,
  connectMode,
  onChange,
  onDelete,
  onSelectForConnect,
}) {
  const [expanded, setExpanded] = useState(isDraft);

  const summary =
    deed.deedInfo?.deedNumber || (isDraft ? "(unsaved deed)" : "(no deed no.)");
  const buyer = deed.purchasers?.[0]?.name;

  return (
    <div
      className={`w-80 border rounded-lg bg-white shadow-sm p-3 ${
        isSelectedForConnect ? "ring-2 ring-blue-500" : ""
      } ${connectMode ? "cursor-pointer" : ""}`}
      onClick={connectMode ? () => onSelectForConnect(deed) : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">
            {summary} {isDraft && <span className="text-amber-600 text-xs">(unsaved)</span>}
          </p>
          {buyer && <p className="text-xs text-slate-500">Buyer: {buyer}</p>}
        </div>
        {!connectMode && (
          <div className="flex gap-2">
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? "Collapse" : "Edit"}
            </button>
            <button
              className="text-xs text-red-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {expanded && !connectMode && (
        <div className="mt-3 border-t pt-3">
          <DeedForm deed={deed} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
