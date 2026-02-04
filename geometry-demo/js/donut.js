import { polygonFromStroke, boundingBoxVertices, isRound, pointInPolygon, triCentroid, signedArea } from './geometry.js';
import { snapPolygonAxisAligned } from './snapping.js';
import { earClipTriangulate } from './triangulation.js';

// ===================== Donut Helpers =====================

function classifyDonutFromStrokes(strokes, { gridSize = 25, snapEnabled = true } = {}) {
  if (strokes.length < 1) return null;
  const polyA = polygonFromStroke(strokes[0]);
  if (!polyA) return null;
  if (strokes.length === 1) {
    // outer-only preview
    // ensure CCW
    if (signedArea(polyA.vertices) < 0) polyA.vertices.reverse();
    const snappedOuter = snapEnabled ? snapPolygonAxisAligned(polyA, gridSize) : polyA;
    return {
      mode: "outer-only",
      outerRaw: polyA,
      snappedOuter,
      innerRaw: null,
      snappedInner: null
    };
  } else {
    // full donut
    const polyB = polygonFromStroke(strokes[1]);
    if (!polyB) return null;
    const areaA = Math.abs(signedArea(polyA.vertices));
    const areaB = Math.abs(signedArea(polyB.vertices));
    let outerRaw, innerRaw;
    if (areaA > areaB) {
      outerRaw = polyA; innerRaw = polyB;
    } else {
      outerRaw = polyB; innerRaw = polyA;
    }
    if (signedArea(outerRaw.vertices) < 0) outerRaw.vertices.reverse();
    if (signedArea(innerRaw.vertices) > 0) innerRaw.vertices.reverse();

    const snappedOuter = snapEnabled ? snapPolygonAxisAligned(outerRaw, gridSize) : outerRaw;
    const snappedInner = snapEnabled ? snapPolygonAxisAligned(innerRaw, gridSize) : innerRaw;

    return {
      mode: "full",
      outerRaw,
      innerRaw,
      snappedOuter,
      snappedInner
    };
  }
}

function donutRectangles(snappedOuter, snappedInner) {
  return {
    rectOuter: boundingBoxVertices(snappedOuter.vertices),
    rectInner: snappedInner ? boundingBoxVertices(snappedInner.vertices) : null
  };
}

function donutCircles(outerRaw, innerRaw) {
  if (!outerRaw || !innerRaw) return { isCircular: false, circleOuter: null, circleInner: null };
  const { round: roundOuter, fit: fitOuter } = isRound(outerRaw, 0.2);
  const { round: roundInner, fit: fitInner } = isRound(innerRaw, 0.2);
  if (roundOuter && roundInner) {
    return {
      isCircular: true,
      circleOuter: { cx: fitOuter.cx, cy: fitOuter.cy, r: fitOuter.r },
      circleInner: { cx: fitInner.cx, cy: fitInner.cy, r: fitInner.r }
    };
  }
  return { isCircular: false, circleOuter: null, circleInner: null };
}

function donutTriangulation(snappedOuter, snappedInner) {
  if (!snappedOuter) return { triangles: [], boxes: [] };
  const trisAll = earClipTriangulate(snappedOuter);
  const holeVerts = snappedInner ? snappedInner.vertices : null;
  const kept = [];
  if (holeVerts) {
    for (const tri of trisAll) {
      const c = triCentroid(tri.a, tri.b, tri.c);
      if (!pointInPolygon(c, holeVerts)) {
        kept.push(tri);
      }
    }
  } else {
    kept.push(...trisAll);
  }
  const boxes = kept.map(t => boundingBoxVertices([t.a, t.b, t.c]));
  return { triangles: kept, boxes };
}


export {
  classifyDonutFromStrokes,
  donutRectangles,
  donutCircles,
  donutTriangulation
};
