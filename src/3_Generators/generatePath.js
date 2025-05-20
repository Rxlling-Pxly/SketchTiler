/**
 * @param {TilemapPoint[]} stroke
 * @returns {SetTileInstruction[]}
 */
export default function generatePath(stroke) {
  const originalPoints = new Set(Array.from(stroke, point => JSON.stringify(point)));
  const newPoints = [];

  for (const point of stroke) {
    const n = { x: point.x, y: point.y-1 };
    const s = { x: point.x, y: point.y+1 };
    const w = { x: point.x-1, y: point.y };
    const e = { x: point.x+1, y: point.y };
    if (originalPoints.has(JSON.stringify(n))) continue;
    if (originalPoints.has(JSON.stringify(s))) continue;
    if (originalPoints.has(JSON.stringify(w))) continue;
    if (originalPoints.has(JSON.stringify(e))) continue;

    const nw = { x: point.x-1, y: point.y-1 };
    const ne = { x: point.x+1, y: point.y-1 };
    const sw = { x: point.x-1, y: point.y+1 };
    const se = { x: point.x+1, y: point.y+1 };
    if (originalPoints.has(JSON.stringify(nw))) newPoints.push(nw);
    if (originalPoints.has(JSON.stringify(ne))) newPoints.push(ne);
    if (originalPoints.has(JSON.stringify(sw))) newPoints.push(sw);
    if (originalPoints.has(JSON.stringify(se))) newPoints.push(se);
  }

  console.log(stroke);
  console.log(newPoints);

  return stroke;
}