function sqr(x) { return x * x; }
function dist2(a, b) { return sqr(a.x - b.x) + sqr(a.y - b.y); }

function signedArea(vertices) {
  let A = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const p = vertices[i];
    const q = vertices[(i + 1) % n];
    A += p.x * q.y - q.x * p.y;
  }
  return 0.5 * A;
}

function isClockwise(vertices) {
  return signedArea(vertices) < 0;
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}
function simplifyStroke(points, minDist = 3) {
  if (points.length <= 2) return points.slice();
  const out = [points[0]];
  let last = points[0];
  const minDist2 = minDist * minDist;
  for (const p of points) {
    if (dist2(p, last) >= minDist2) {
      out.push(p);
      last = p;
    }
  }
  if (out.length < 2) out.push(points[points.length - 1]);
  return out;
}

function polygonFromStroke(stroke, closeThreshold = 10) {
  if (stroke.length < 3) return null;
  const simp = simplifyStroke(stroke, 4);
  if (simp.length < 3) return null;

  const v = simp.slice();
  const first = v[0];
  const last = v[v.length - 1];

  if (Math.sqrt(dist2(first, last)) > closeThreshold) {
    v.push({ ...first });
  }

  if (v.length < 3) return null;
  if (isClockwise(v)) v.reverse();
  return { vertices: v };
}
function findConcaveVertices(poly) {
  const v = poly.vertices;
  const n = v.length;
  const out = new Array(n).fill(false);
  const area = signedArea(v);
  if (area === 0) return out;
  const ccw = area > 0;

  for (let i = 0; i < n; i++) {
    const prev = v[(i - 1 + n) % n];
    const curr = v[i];
    const next = v[(i + 1) % n];
    const z = cross(prev, curr, next);
    if ((ccw && z < 0) || (!ccw && z > 0)) out[i] = true;
  }
  return out;
}

function boundingBoxVertices(vertices) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of vertices) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
function centroid(poly) {
  const v = poly.vertices;
  let sx = 0, sy = 0;
  for (const p of v) { sx += p.x; sy += p.y; }
  return { x: sx / v.length, y: sy / v.length };
}

function circleFitSimple(poly) {
  const v = poly.vertices;
  const c = centroid(poly);
  const rs = v.map(p => Math.hypot(p.x - c.x, p.y - c.y));
  const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
  const variance = rs.reduce((s, r) => s + (r - mean) ** 2, 0) / rs.length;
  return { cx: c.x, cy: c.y, r: mean, ratio: Math.sqrt(variance) / mean };
}

function isRound(poly, threshold = 0.2) {
  const fit = circleFitSimple(poly);
  return { round: fit.ratio < threshold, fit };
}
function pointInPolygon(p, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    const intersect =
      ((yi > p.y) !== (yj > p.y)) &&
      (p.x < (xj - xi) * (p.y - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function triCentroid(a, b, c) {
  return {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3
  };
}

// ===================== L-Shape Rectangular Decomposition =====================

function computeLDecompositionRects(snappedPoly) {
  const v = snappedPoly.vertices;
  const concave = findConcaveVertices(snappedPoly);
  const ci = concave.findIndex(f => f);
  if (ci === -1) return [];

  const C = v[ci];
  const box = boundingBoxVertices(v);

  const Rbottom = {
    minX: box.minX,
    maxX: box.maxX,
    minY: box.minY,
    maxY: C.y
  };

  const Rleft = {
    minX: box.minX,
    maxX: C.x,
    minY: C.y,
    maxY: box.maxY
  };

  return [Rbottom, Rleft];
}

export {
  sqr, dist2,
  signedArea, isClockwise,
  cross,
  simplifyStroke, polygonFromStroke,
  findConcaveVertices,
  boundingBoxVertices,
  centroid, circleFitSimple, isRound,
  pointInPolygon, triCentroid,
  computeLDecompositionRects
};
