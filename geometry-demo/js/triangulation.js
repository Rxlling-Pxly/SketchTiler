import { dist2, signedArea, cross } from './geometry.js';

// ===================== Ear-Clipping Triangulation =====================

function pointInTriangle(p, a, b, c) {
  function sign(p1, p2, p3) {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  }
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function earClipTriangulate(poly) {
  const verts = poly.vertices.slice();
  // remove duplicate last vertex if present
  if (verts.length > 1) {
    const f = verts[0], l = verts[verts.length - 1];
    if (dist2(f, l) < 1e-6) verts.pop();
  }
  if (verts.length < 3) return [];

  if (signedArea(verts) < 0) verts.reverse();
  const n = verts.length;
  const indices = [];
  for (let i = 0; i < n; i++) indices.push(i);

  const triangles = [];

  function isEar(iIndex) {
    const nI = indices.length;
    const iPrev = indices[(iIndex - 1 + nI) % nI];
    const i = indices[iIndex];
    const iNext = indices[(iIndex + 1) % nI];
    const A = verts[iPrev], B = verts[i], C = verts[iNext];

    // convex check
    if (cross(A, B, C) <= 0) return false;

    // ensure no other vertex inside
    for (let jIdx = 0; jIdx < nI; jIdx++) {
      const j = indices[jIdx];
      if (j === iPrev || j === i || j === iNext) continue;
      const P = verts[j];
      if (pointInTriangle(P, A, B, C)) return false;
    }
    return true;
  }

  while (indices.length > 3) {
    let earFound = false;
    for (let iIdx = 0; iIdx < indices.length; iIdx++) {
      if (!isEar(iIdx)) continue;
      const nI = indices.length;
      const iPrev = indices[(iIdx - 1 + nI) % nI];
      const i = indices[iIdx];
      const iNext = indices[(iIdx + 1) % nI];
      const A = verts[iPrev], B = verts[i], C = verts[iNext];

      triangles.push({ a: A, b: B, c: C });
      indices.splice(iIdx, 1);
      earFound = true;
      break;
    }
    if (!earFound) break;
  }
  if (indices.length === 3) {
    const A = verts[indices[0]], B = verts[indices[1]], C = verts[indices[2]];
    triangles.push({ a: A, b: B, c: C });
  }
  return triangles;
}


export { earClipTriangulate };
