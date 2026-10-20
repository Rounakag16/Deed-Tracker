// Print utilities for DeedTracker.
// Each function opens a new browser window with a clean, light-themed,
// print-optimized rendering of the requested data, then triggers the
// browser's native print dialog. This approach avoids any interference
// with the main app's dark-theme DOM or CSS transform-based canvas.

const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; padding: 40px; line-height: 1.6; }
  h1 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 6px; }
  h2 { font-size: 16px; color: #555; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta { font-size: 12px; color: #888; margin-bottom: 20px; }
  .section { margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .value { font-size: 14px; margin-bottom: 12px; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 11px; color: #aaa; text-align: center; }
  .parcel-box { border: 1px solid #ddd; padding: 12px; border-radius: 4px; margin-bottom: 8px; background: #fafafa; }
  @media print {
    body { padding: 20px; }
    @page { margin: 15mm; }
  }
`;

function openPrintWindow(htmlContent, title) {
  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) {
    alert("Please allow pop-ups to use the print feature.");
    return;
  }
  win.document.write(
    `<!DOCTYPE html><html><head><title>${title}</title><style>${PRINT_STYLES}</style></head><body>${htmlContent}</body></html>`
  );
  win.document.close();
  // Small delay so styles are applied before the print dialog opens.
  setTimeout(() => win.print(), 350);
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---- C3: Print a single deed (called from DeedSidebar) ---- //

export function printDeed(deed) {
  const num = escapeHtml(deed.deedInfo?.deedNumber) || "(no deed no.)";

  const purchasers = (deed.purchasers || [])
    .map((p) => `<tr><td>${escapeHtml(p.name) || "—"}</td><td>${escapeHtml(p.fatherName) || "—"}</td></tr>`)
    .join("");

  const sellers = (deed.sellers || [])
    .map((s) => `<tr><td>${escapeHtml(s.name) || "—"}</td><td>${escapeHtml(s.fatherName) || "—"}</td></tr>`)
    .join("");

  const parcels = (deed.landParcels || [])
    .map(
      (lp) => `
    <div class="parcel-box">
      <div class="grid">
        <div><div class="label">Total Area</div><div class="value">${escapeHtml(lp.area) || "—"}</div></div>
        <div><div class="label">Mouja</div><div class="value">${escapeHtml(lp.mouja) || "—"}</div></div>
        <div><div class="label">Sheet No.</div><div class="value">${escapeHtml(lp.sheetNo) || "—"}</div></div>
      </div>
      <div><div class="label">Khatiya Numbers</div><div class="value">${(lp.khatiyas || []).map((k) => escapeHtml(k.number)).filter(Boolean).join(", ") || "—"}</div></div>
      <div><div class="label">Plots (RS / LR / Area)</div>
        <table><tr><th>RS</th><th>LR</th><th>Area</th></tr>
        ${(lp.plots || []).map((p) => `<tr><td>${escapeHtml(p.rs) || "—"}</td><td>${escapeHtml(p.lr) || "—"}</td><td>${escapeHtml(p.area) || "—"}</td></tr>`).join("")}
        </table>
      </div>
    </div>`
    )
    .join("");

  const html = `
    <h1>Deed: ${num}</h1>
    <p class="meta">${escapeHtml(deed.title) ? `<em>${escapeHtml(deed.title)}</em> · ` : ""}Printed from DeedTracker on ${new Date().toLocaleDateString()}</p>
    <div class="section">
      <h2>Registration Details</h2>
      <div class="grid">
        <div><div class="label">Deed No.</div><div class="value">${escapeHtml(deed.deedInfo?.deedNumber) || "—"}</div></div>
        <div><div class="label">Volume No.</div><div class="value">${escapeHtml(deed.deedInfo?.volumeNumber) || "—"}</div></div>
        <div><div class="label">Page No.</div><div class="value">${escapeHtml(deed.deedInfo?.pageNumber) || "—"}</div></div>
        <div><div class="label">Office No.</div><div class="value">${escapeHtml(deed.deedInfo?.officeNumber) || "—"}</div></div>
      </div>
    </div>
    <div class="section">
      <h2>Purchasers</h2>
      <table><tr><th>Name</th><th>Father's Name</th></tr>${purchasers}</table>
    </div>
    <div class="section">
      <h2>Sellers</h2>
      <table><tr><th>Name</th><th>Father's Name</th></tr>${sellers}</table>
    </div>
    <div class="section">
      <h2>Land Parcels</h2>
      ${parcels || "<p>No parcels recorded.</p>"}
    </div>
    <div class="footer">DeedTracker</div>
  `;
  openPrintWindow(html, `Deed ${num}`);
}

// ---- C2: Print search results (called from SearchPanel) ---- //

export function printSearchResults(results, query, workspaceName) {
  const rows = results
    .map(
      ({ deed }) => `
    <tr>
      <td>${escapeHtml(deed.deedInfo?.deedNumber) || "—"}</td>
      <td>${(deed.purchasers || []).map((p) => escapeHtml(p.name)).filter(Boolean).join(", ") || "—"}</td>
      <td>${(deed.sellers || []).map((s) => escapeHtml(s.name)).filter(Boolean).join(", ") || "—"}</td>
      <td>${(deed.landParcels || []).map((lp) => escapeHtml(lp.mouja)).filter(Boolean).join(", ") || "—"}</td>
      <td>${(deed.landParcels || []).map((lp) => escapeHtml(lp.area)).filter(Boolean).join(", ") || "—"}</td>
    </tr>`
    )
    .join("");

  const html = `
    <h1>Search Results: "${escapeHtml(query)}"</h1>
    <p class="meta">${workspaceName ? `Workspace: ${escapeHtml(workspaceName)} · ` : "All workspaces · "}${results.length} result(s) · Printed ${new Date().toLocaleDateString()}</p>
    <table>
      <tr><th>Deed No.</th><th>Purchasers</th><th>Sellers</th><th>Mouja</th><th>Area</th></tr>
      ${rows}
    </table>
    <div class="footer">DeedTracker Search Export</div>
  `;
  openPrintWindow(html, `Search: ${query}`);
}

// ---- C1: Print full workspace deed list (called from Canvas toolbar) ---- //

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
    ${
      relationships.length > 0
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
