// Longest-path layering: a node's layer is 1 + the deepest of its parents'
// layers, so converging deeds (multiple sources) always sit to the right of
// every one of their sources, and diverging deeds (multiple children) each
// get their own downstream layer. Shared between the edit canvas and the
// read-only lineage view so both lay the same workspace out identically.
//
// `edges` is an array of { sourceKey, targetKey } using whatever key scheme
// the caller uses (Mongo _id strings, temp draft ids, etc - just has to be
// consistent with `ids`).
export function computeLayers(ids, edges) {
  const parentsOf = new Map();
  edges.forEach(({ sourceKey, targetKey }) => {
    if (!parentsOf.has(targetKey)) parentsOf.set(targetKey, []);
    parentsOf.get(targetKey).push(sourceKey);
  });

  const layer = new Map();
  const visiting = new Set();

  function layerOf(id) {
    if (layer.has(id)) return layer.get(id);
    if (visiting.has(id)) return 0; // cycle guard - shouldn't happen, but don't hang
    visiting.add(id);
    const parents = (parentsOf.get(id) || []).filter((p) => ids.includes(p));
    const l = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(layerOf));
    visiting.delete(id);
    layer.set(id, l);
    return l;
  }

  ids.forEach(layerOf);
  return layer;
}

// Turns a layer-per-id map into concrete x/y positions.
// direction: "vertical" (top-to-bottom, like a workflow diagram - layer = row,
// siblings spread left-right) or "horizontal" (left-to-right - layer = column,
// siblings stack top-down).
export function computePositions(
  ids,
  layerById,
  { nodeW, nodeH, colGap, rowGap, padding, direction = "vertical" }
) {
  const byLayer = new Map();
  ids.forEach((id) => {
    const l = layerById.get(id) ?? 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l).push(id);
  });

  const positions = new Map();
  byLayer.forEach((idsInLayer, l) => {
    idsInLayer.forEach((id, i) => {
      positions.set(
        id,
        direction === "vertical"
          ? { x: padding + i * (nodeW + colGap), y: padding + l * (nodeH + rowGap) }
          : { x: padding + l * (nodeW + colGap), y: padding + i * (nodeH + rowGap) }
      );
    });
  });

  const maxLayer = Math.max(0, ...[...byLayer.keys()]);
  const maxPerLayer = Math.max(1, ...[...byLayer.values()].map((v) => v.length));

  const width =
    direction === "vertical"
      ? padding * 2 + maxPerLayer * nodeW + (maxPerLayer - 1) * colGap
      : padding * 2 + (maxLayer + 1) * nodeW + maxLayer * colGap;
  const height =
    direction === "vertical"
      ? padding * 2 + (maxLayer + 1) * nodeH + maxLayer * rowGap
      : padding * 2 + maxPerLayer * nodeH + (maxPerLayer - 1) * rowGap;

  return { positions, width, height };
}
