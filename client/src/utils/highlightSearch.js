// Cumulative search highlight utilities for the Search tab workspace view.

export const HIGHLIGHT_COLORS = [
  "#e6a93c", // Gold / amber
  "#4f9a8c", // Teal / verdigris
  "#e06070", // Rose
  "#6fa0e6", // Sky blue
  "#c77dde", // Violet
  "#e89050", // Orange
  "#5cc97d", // Mint
  "#e66eb0", // Pink
];

export const SEARCHABLE_FIELDS = [
  { value: "plotNoRS",        label: "Plot No. (RS)" },
  { value: "plotNoLR",        label: "Plot No. (LR)" },
  { value: "officeNo",        label: "Office No." },
  { value: "deedNo",          label: "Deed No." },
  { value: "purchaser",       label: "Purchaser (To)" },
  { value: "seller",          label: "Seller (From)" },
  { value: "purchaserFather", label: "Purchaser Father's Name" },
  { value: "sellerFather",    label: "Seller Father's Name" },
  { value: "mouja",           label: "Mouja" },
  { value: "khatiyaNo",       label: "Khatiya No." },
  { value: "area",            label: "Area" },
  { value: "volumeNo",        label: "Volume No." },
  { value: "pageNo",          label: "Page No." },
  { value: "sheetNo",         label: "Sheet No." },
  { value: "title",           label: "Title / Reference" },
  { value: "all",             label: "All Fields" },
];

function normalizeStr(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[\s\-_/.]+/g, " ")
    .trim();
}

export function isValueMatch(actual, query, exact = false) {
  if (actual === null || actual === undefined) return false;
  const rawActual = String(actual).trim().toLowerCase();
  const rawQuery = String(query).trim().toLowerCase();
  if (!rawActual || !rawQuery) return false;

  // Direct exact or substring match
  if (exact ? rawActual === rawQuery : rawActual.includes(rawQuery)) {
    return true;
  }

  // Normalized match (handles hyphen/space/slash differences like "ADSR-RAJ" vs "ADSR RAJ")
  const normActual = normalizeStr(actual);
  const normQuery = normalizeStr(query);
  if (exact ? normActual === normQuery : normActual.includes(normQuery)) {
    return true;
  }

  return false;
}

export function matchesDeed(deed, field, value, exact = false) {
  if (!value || !value.trim()) return [];
  const query = value.trim();
  const hits = [];

  const check = (actual, label, fieldKey) => {
    if (actual === null || actual === undefined) return;
    const str = String(actual).trim();
    if (!str) return;

    if (isValueMatch(str, query, exact)) {
      hits.push({
        fieldKey,
        fieldLabel: label,
        displayValue: str,
      });
    }
  };

  switch (field) {
    case "plotNoRS":
      (deed.landParcels || []).forEach((lp) =>
        (lp.plots || []).forEach((p) => check(p.rs, "Plot No. (RS)", "plotNoRS"))
      );
      break;
    case "plotNoLR":
      (deed.landParcels || []).forEach((lp) =>
        (lp.plots || []).forEach((p) => check(p.lr, "Plot No. (LR)", "plotNoLR"))
      );
      break;
    case "officeNo":
      check(deed.deedInfo?.officeNumber, "Office No.", "officeNo");
      break;
    case "deedNo":
      check(deed.deedInfo?.deedNumber, "Deed No.", "deedNo");
      break;
    case "purchaser":
      (deed.purchasers || []).forEach((p) => {
        check(p.name, "Purchaser", "purchaser");
        check(p.fatherName, "Purchaser Father", "purchaserFather");
      });
      break;
    case "seller":
      (deed.sellers || []).forEach((s) => {
        check(s.name, "Seller", "seller");
        check(s.fatherName, "Seller Father", "sellerFather");
      });
      break;
    case "purchaserFather":
      (deed.purchasers || []).forEach((p) =>
        check(p.fatherName, "Purchaser Father", "purchaserFather")
      );
      break;
    case "sellerFather":
      (deed.sellers || []).forEach((s) =>
        check(s.fatherName, "Seller Father", "sellerFather")
      );
      break;
    case "mouja":
      (deed.landParcels || []).forEach((lp) => check(lp.mouja, "Mouja", "mouja"));
      break;
    case "khatiyaNo":
      (deed.landParcels || []).forEach((lp) =>
        (lp.khatiyas || []).forEach((k) => check(k.number, "Khatiya No.", "khatiyaNo"))
      );
      break;
    case "area":
      (deed.landParcels || []).forEach((lp) => {
        check(lp.area, "Area", "area");
        (lp.plots || []).forEach((p) => check(p.area, "Plot Area", "area"));
      });
      break;
    case "volumeNo":
      check(deed.deedInfo?.volumeNumber, "Volume No.", "volumeNo");
      break;
    case "pageNo":
      check(deed.deedInfo?.pageNumber, "Page No.", "pageNo");
      break;
    case "sheetNo":
      (deed.landParcels || []).forEach((lp) => check(lp.sheetNo, "Sheet No.", "sheetNo"));
      break;
    case "title":
      check(deed.title, "Title", "title");
      break;
    case "all":
      check(deed.deedInfo?.deedNumber, "Deed No.", "deedNo");
      check(deed.deedInfo?.volumeNumber, "Volume No.", "volumeNo");
      check(deed.deedInfo?.pageNumber, "Page No.", "pageNo");
      check(deed.deedInfo?.officeNumber, "Office No.", "officeNo");
      check(deed.title, "Title", "title");
      (deed.purchasers || []).forEach((p) => {
        check(p.name, "Purchaser", "purchaser");
        check(p.fatherName, "Purchaser Father", "purchaserFather");
      });
      (deed.sellers || []).forEach((s) => {
        check(s.name, "Seller", "seller");
        check(s.fatherName, "Seller Father", "sellerFather");
      });
      (deed.landParcels || []).forEach((lp) => {
        check(lp.mouja, "Mouja", "mouja");
        check(lp.sheetNo, "Sheet No.", "sheetNo");
        check(lp.area, "Area", "area");
        (lp.khatiyas || []).forEach((k) => check(k.number, "Khatiya No.", "khatiyaNo"));
        (lp.plots || []).forEach((p) => {
          check(p.rs, "Plot No. (RS)", "plotNoRS");
          check(p.lr, "Plot No. (LR)", "plotNoLR");
          check(p.area, "Plot Area", "area");
        });
      });
      break;
    default:
      break;
  }

  return hits;
}

// Computes the highlight hits for every deed card based on all active cumulative layers
export function computeHighlights(allCards, keyFor, layers) {
  const result = new Map();
  if (!layers || layers.length === 0) return result;

  allCards.forEach((deed) => {
    const key = keyFor(deed);
    const deedHits = [];
    layers.forEach((layer) => {
      const hits = matchesDeed(deed, layer.field, layer.value, layer.exact);
      hits.forEach((hit) => {
        deedHits.push({
          color: layer.color,
          layerId: layer.id,
          fieldKey: hit.fieldKey,
          fieldLabel: hit.fieldLabel,
          displayValue: hit.displayValue,
          layerField: layer.field,
          layerValue: layer.value,
          exact: layer.exact,
        });
      });
    });
    if (deedHits.length > 0) {
      result.set(key, deedHits);
    }
  });

  return result;
}

// Counts how many deeds matched each layer
export function countMatchesPerLayer(allCards, layers) {
  const counts = new Map();
  layers.forEach((l) => counts.set(l.id, 0));

  allCards.forEach((deed) => {
    layers.forEach((layer) => {
      const hits = matchesDeed(deed, layer.field, layer.value, layer.exact);
      if (hits.length > 0) {
        counts.set(layer.id, (counts.get(layer.id) || 0) + 1);
      }
    });
  });

  return counts;
}
