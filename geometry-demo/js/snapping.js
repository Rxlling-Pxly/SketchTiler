import { dist2 } from './geometry.js';

function snapPolygonAxisAligned(poly, grid = 25) {
  const raw = poly.vertices;
  if (raw.length < 2) return poly;
  const snapped = [];
  let prev = {
    x: Math.round(raw[0].x / grid) * grid,
    y: Math.round(raw[0].y / grid) * grid
  };
  snapped.push(prev);

  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1], b = raw[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let nx, ny;
    if (Math.abs(dx) >= Math.abs(dy)) {
      // horizontal
      nx = Math.round(b.x / grid) * grid;
      ny = prev.y;
    } else {
      // vertical
      nx = prev.x;
      ny = Math.round(b.y / grid) * grid;
    }
    if (nx !== prev.x || ny !== prev.y) {
      prev = { x: nx, y: ny };
      snapped.push(prev);
    }
  }

  const first = snapped[0], last = snapped[snapped.length - 1];
  if (dist2(first, last) > 1) snapped.push({ x: first.x, y: first.y });
  return { vertices: snapped };
}

export { snapPolygonAxisAligned };
