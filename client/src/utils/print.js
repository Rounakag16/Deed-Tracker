// Print utilities for DeedTracker.
// Each function opens a new browser window with a clean, light-themed,
// print-optimized rendering of the requested data, then triggers the
// browser's native print dialog. This approach avoids any interference
// with the main app's dark-theme DOM or CSS transform-based canvas.

const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1e2530; padding: 32px; line-height: 1.5; font-size: 13px; background: #fff; }
  .deed-record { border: 1.5px solid #2d3748; border-radius: 8px; padding: 24px; margin-bottom: 32px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.08); page-break-inside: avoid; }
  .deed-header { border-bottom: 2px solid #2d3748; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
  .deed-title-num { font-size: 22px; font-weight: 700; font-family: Georgia, 'Times New Roman', serif; color: #0f172a; }
  .deed-subtitle { font-size: 13px; color: #64748b; margin-top: 2px; }
  .deed-badge { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-family: monospace; color: #334155; }
  h2 { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #334155; margin-top: 18px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 14px 0; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; }
  .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 2px; }
  .value { font-size: 13px; font-weight: 500; color: #0f172a; word-break: break-word; }
  .parcel-box { border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 10px; background: #f8fafc; }
  .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  .lineage-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 11px; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; font-weight: 500; }
  @media print {
    body { padding: 12mm 15mm; }
    .page-break { page-break-after: always; }
    .deed-record { box-shadow: none; border-color: #333; margin-bottom: 20px; }
    @page { margin: 10mm; }
  }
`;

function openPrintWindow(htmlContent, title) {
  const win = window.open("", "_blank", "width=850,height=750");
  if (!win) {
    alert("Please allow pop-ups to use the print feature.");
    return;
  }
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>${PRINT_STYLES}</style></head><body>${htmlContent}</body></html>`
  );
  win.document.close();
  // Small delay so styles are applied before the print dialog opens.
  setTimeout(() => win.print(), 350);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Builds the complete, printable HTML representation of a single deed record
export function renderDeedRecordHtml(deed, parents = [], children = []) {
  const deedNum = escapeHtml(deed.deedInfo?.deedNumber) || "(no deed no.)";
  const title = escapeHtml(deed.title) || "";
  const vol = escapeHtml(deed.deedInfo?.volumeNumber) || "—";
  const page = escapeHtml(deed.deedInfo?.pageNumber) || "—";
  const office = escapeHtml(deed.deedInfo?.officeNumber) || "—";

  const purchasers = (deed.purchasers || [])
    .map((p) => `<tr><td>${escapeHtml(p.name) || "—"}</td><td>${escapeHtml(p.fatherName) || "—"}</td></tr>`)
    .join("");

  const sellers = (deed.sellers || [])
    .map((s) => `<tr><td>${escapeHtml(s.name) || "—"}</td><td>${escapeHtml(s.fatherName) || "—"}</td></tr>`)
    .join("");

  const parcels = (deed.landParcels || [])
    .map(
      (lp, idx) => `
    <div class="parcel-box">
      <div style="font-weight: 600; font-size: 11px; color: #475569; margin-bottom: 6px; text-transform: uppercase;">
        Parcel #${idx + 1}
      </div>
      <div class="grid-4" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 8px;">
        <div><div class="label">Total Area</div><div class="value">${escapeHtml(lp.area) || "—"}</div></div>
        <div><div class="label">Mouja</div><div class="value">${escapeHtml(lp.mouja) || "—"}</div></div>
        <div><div class="label">Sheet No.</div><div class="value">${escapeHtml(lp.sheetNo) || "—"}</div></div>
      </div>
      <div style="margin-bottom: 8px;">
        <div class="label">Khatiya Numbers</div>
        <div class="value">${(lp.khatiyas || []).map((k) => escapeHtml(k.number)).filter(Boolean).join(", ") || "—"}</div>
      </div>
      <div>
        <div class="label">Plots (RS / LR / Area)</div>
        <table>
          <thead>
            <tr><th>RS Plot</th><th>LR Plot</th><th>Plot Area</th></tr>
          </thead>
          <tbody>
            ${(lp.plots || []).length > 0
          ? (lp.plots || [])
            .map(
              (p) =>
                `<tr><td>${escapeHtml(p.rs) || "—"}</td><td>${escapeHtml(p.lr) || "—"}</td><td>${escapeHtml(p.area) || "—"}</td></tr>`
            )
            .join("")
          : `<tr><td colspan="3" style="color: #94a3b8; text-align: center;">No plot records</td></tr>`
        }
          </tbody>
        </table>
      </div>
    </div>`
    )
    .join("");

  // Lineage: Sourced from (parents)
  const parentsHtml =
    parents.length > 0
      ? `<table>
          <thead><tr><th>Source Deed No.</th><th>Title / Ref</th><th>Area Transferred</th><th>Note</th></tr></thead>
          <tbody>
            ${parents
        .map(
          (p) =>
            `<tr>
                    <td><strong>${escapeHtml(p.deedNumber || p.deedInfo?.deedNumber || "—")}</strong></td>
                    <td>${escapeHtml(p.title) || "—"}</td>
                    <td>${escapeHtml(p.areaTransferred) || "—"}</td>
                    <td>${escapeHtml(p.note) || "—"}</td>
                  </tr>`
        )
        .join("")}
          </tbody>
        </table>`
      : `<p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 12px;">Root deed — no earlier source registered.</p>`;

  // Lineage: Derived into (children)
  const childrenHtml =
    children.length > 0
      ? `<table>
          <thead><tr><th>Derived Deed No.</th><th>Title / Ref</th><th>Area Transferred</th><th>Note</th></tr></thead>
          <tbody>
            ${children
        .map(
          (c) =>
            `<tr>
                    <td><strong>${escapeHtml(c.deedNumber || c.deedInfo?.deedNumber || "—")}</strong></td>
                    <td>${escapeHtml(c.title) || "—"}</td>
                    <td>${escapeHtml(c.areaTransferred) || "—"}</td>
                    <td>${escapeHtml(c.note) || "—"}</td>
                  </tr>`
        )
        .join("")}
          </tbody>
        </table>`
      : `<p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 12px;">No subsequent deeds derive from this one yet.</p>`;

  return `
    <div class="deed-record">
      <div class="deed-header">
        <div>
          <div class="deed-title-num">Deed No. ${deedNum}</div>
          ${title ? `<div class="deed-subtitle">${title}</div>` : ""}
        </div>
        <div style="text-align: right;">
          <span class="deed-badge">RECORD COPY</span>
          ${deed._id ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 4px; font-family: monospace;">ID: ${escapeHtml(deed._id)}</div>` : ""}
        </div>
      </div>

      <h2>1. Registration Details</h2>
      <div class="grid-4">
        <div><div class="label">Deed No.</div><div class="value">${deedNum}</div></div>
        <div><div class="label">Volume No.</div><div class="value">${vol}</div></div>
        <div><div class="label">Page No.</div><div class="value">${page}</div></div>
        <div><div class="label">Office No.</div><div class="value">${office}</div></div>
      </div>

      <div class="grid-2">
        <div>
          <h2>2. Purchasers (To)</h2>
          <table>
            <thead><tr><th>Name</th><th>Father's Name</th></tr></thead>
            <tbody>
              ${purchasers || `<tr><td colspan="2" style="color: #94a3b8;">None recorded</td></tr>`}
            </tbody>
          </table>
        </div>
        <div>
          <h2>3. Sellers (From)</h2>
          <table>
            <thead><tr><th>Name</th><th>Father's Name</th></tr></thead>
            <tbody>
              ${sellers || `<tr><td colspan="2" style="color: #94a3b8;">None recorded</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <h2>4. Land Parcels &amp; Plot Details</h2>
      ${parcels || `<p style="color: #94a3b8; font-size: 12px;">No land parcels recorded.</p>`}

      <div class="grid-2" style="margin-top: 8px;">
        <div>
          <h2>5. Sourced From (Earlier Deeds)</h2>
          ${parentsHtml}
        </div>
        <div>
          <h2>6. Derived Into (Later Deeds)</h2>
          ${childrenHtml}
        </div>
      </div>

      <div class="footer">
        DeedTracker Full Record · Printed on ${new Date().toLocaleString()}
      </div>
    </div>
  `;
}

// Print a single complete deed record
export function printFullDeedRecord(deed, parents = [], children = []) {
  const deedNum = deed.deedInfo?.deedNumber || "Deed";
  const html = renderDeedRecordHtml(deed, parents, children);
  openPrintWindow(html, `Deed Record - ${deedNum}`);
}

// Print all search results as full complete deed records
export function printAllDeedRecords(results, query, topicLabel, workspaceName) {
  const headerHtml = `
    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
        Search Results: "${escapeHtml(query)}" ${topicLabel ? `(${escapeHtml(topicLabel)})` : ""}
      </h1>
      <p class="meta" style="margin-bottom: 0;">
        ${workspaceName ? `Workspace: <strong>${escapeHtml(workspaceName)}</strong> · ` : "All Workspaces · "}
        ${results.length} complete deed record(s) · Printed on ${new Date().toLocaleString()}
      </p>
    </div>
  `;

  const recordsHtml = results
    .map(({ deed, parents = [], children = [] }, i) => {
      const isLast = i === results.length - 1;
      return `
        <div>
          ${renderDeedRecordHtml(deed, parents, children)}
          ${!isLast ? `<div class="page-break"></div>` : ""}
        </div>
      `;
    })
    .join("");

  openPrintWindow(`${headerHtml}${recordsHtml}`, `DeedTracker Search - ${query}`);
}

// Legacy print functions preserved for compatibility
export function printDeed(deed) {
  printFullDeedRecord(deed, [], []);
}

export function printSearchResults(results, query, workspaceName) {
  printAllDeedRecords(results, query, "", workspaceName);
}

export function printWorkspace(deeds, relationships, workspaceName) {
  const deedById = new Map(deeds.map((d) => [String(d._id), d]));

  const deedRows = deeds
    .map(
      (deed) => `
    <tr>
      <td>${escapeHtml(deed.deedInfo?.deedNumber) || "—"}</td>
      <td>${escapeHtml(deed.deedInfo?.volumeNumber) || "—"}</td>
      <td>${escapeHtml(deed.deedInfo?.pageNumber) || "—"}</td>
      <td>${(deed.purchasers || []).map((p) => escapeHtml(p.name)).filter(Boolean).join(", ") || "—"}</td>
      <td>${(deed.sellers || []).map((s) => escapeHtml(s.name)).filter(Boolean).join(", ") || "—"}</td>
      <td>${(deed.landParcels || []).map((lp) => escapeHtml(lp.mouja)).filter(Boolean).join(", ") || "—"}</td>
      <td>${(deed.landParcels || []).map((lp) => escapeHtml(lp.area)).filter(Boolean).join(", ") || "—"}</td>
    </tr>`
    )
    .join("");

  const relRows = relationships
    .map((r) => {
      const src = deedById.get(String(r.sourceDeedId));
      const tgt = deedById.get(String(r.targetDeedId));
      return `<tr>
        <td>${escapeHtml(src?.deedInfo?.deedNumber) || "?"}</td>
        <td>${escapeHtml(tgt?.deedInfo?.deedNumber) || "?"}</td>
        <td>${escapeHtml(r.areaTransferred) || "—"}</td>
        <td>${escapeHtml(r.note) || "—"}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <h1>${escapeHtml(workspaceName)} — All Deeds</h1>
    <p class="meta">${deeds.length} deed(s) · ${relationships.length} relationship(s) · Printed ${new Date().toLocaleDateString()}</p>
    <table>
      <tr><th>Deed No.</th><th>Volume</th><th>Page</th><th>Purchasers</th><th>Sellers</th><th>Mouja</th><th>Area</th></tr>
      ${deedRows}
    </table>
    ${relationships.length > 0
      ? `
      <h2>Relationships</h2>
      <table>
        <tr><th>Source Deed (Parent)</th><th>Target Deed (Derived)</th><th>Area Transferred</th><th>Note</th></tr>
        ${relRows}
      </table>`
      : ""
    }
    <div class="footer">DeedTracker · ${escapeHtml(workspaceName)}</div>
  `;
  openPrintWindow(html, `${workspaceName} — All Deeds`);
}
