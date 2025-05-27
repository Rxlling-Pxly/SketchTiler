import { ramerDouglasPeucker } from "./lineCleanup.js";

// helper: approximates the center of the shape by averaging the x and y values of each point
export function getCentroid(pts) {
  const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }));
  return { x: sum.x / pts.length, y: sum.y / pts.length };
}

// helper: returns whether stroke is closed (end point within threshold from start)
export function isClosed(pts, threshold = 60) {
  // compute euclidean distance between start and end point
  const dist = Math.hypot(
    pts[0].x - pts[pts.length - 1].x,
    pts[0].y - pts[pts.length - 1].y
  );
  return dist < threshold;
}

// helper: calculate + count the angles between adjacent point triplets
export function countSharpAngles(points, angleThreshold = 110) {
  if (points.length < 3) return 0;
  let sharpAngles = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const c = i === points.length - 1 ? points[1] : points[i + 1]; // wrap if last point

    const ab = { x: a.x - b.x, y: a.y - b.y };
    const cb = { x: c.x - b.x, y: c.y - b.y };

    const dot = ab.x * cb.x + ab.y * cb.y;
    const magAB = Math.hypot(ab.x, ab.y);
    const magCB = Math.hypot(cb.x, cb.y);
    const cosAngle = dot / (magAB * magCB);

    const angle = Math.acos(cosAngle) * (180 / Math.PI);

    if (angle < angleThreshold) {
      sharpAngles++;
    }
  }
  return sharpAngles;
}

// determine whether two regions are overlapped (more than threshold, t)
export function isOverlapped(r1, r2, t) {
  const overlapX =
    Math.min(r1.bottomRight.x, r2.bottomRight.x) -
    Math.max(r1.topLeft.x, r2.topLeft.x);
  const overlapY =
    Math.min(r1.bottomRight.y, r2.bottomRight.y) -
    Math.max(r1.topLeft.y, r2.topLeft.y);

  // If both width and height of the overlapping region exceed the threshold
  return overlapX > t && overlapY > t;
}

// Simplify to (approximately) a line
export function simplifyToLine(stroke) {
  let t = 50;
  let reduced = ramerDouglasPeucker(stroke, t);
  while (reduced.length > 2 && t < 1000) {
    t += 50;
    reduced = ramerDouglasPeucker(stroke, t);
  }
  return reduced;
}

// for "box" region types
//    gets min x,y and max x,y of stroke to create a bounding bow region around stroke
export function getBoundingBox(points) {
  // get top-left and bottom-right of stroke and fill in that region of tiles
  let topLeft = { x: Infinity, y: Infinity };
  let bottomRight = { x: -1, y: -1 };
  for (let point of points) {
    // top-left
    if (point.x < topLeft.x) {
      topLeft.x = point.x;
    }
    if (point.y < topLeft.y) {
      topLeft.y = point.y;
    }

    // bottom-right
    if (point.x > bottomRight.x) {
      bottomRight.x = point.x;
    }
    if (point.y > bottomRight.y) {
      bottomRight.y = point.y;
    }
  }

  return {
    topLeft: topLeft,
    bottomRight: bottomRight,
    width: 1 + bottomRight.x - topLeft.x,
    height: 1 + bottomRight.y - topLeft.y,
  };
}

// for "trace" region types
//    returns an array of the the grid cells that stroke points pass through
export function getTrace(points) {
  let result = points;

  // normalized squares, triangles will have very few points.
  //    need to fill in-between tiles in these cases
  if (result.length < 5) {
    result = completeShape(result);
  }

  return result;
}

// uses linear interpolation to fill empty cells in shapes with few points
//    prevents squares, triangles, etc from being represented as just their angle points
export function completeShape(points) {
  if (!points || points.length < 2) return points;

  const filled = [];

  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    const end = points[(i + 1) % points.length]; // next point (wraps around for closed shape)

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));

    // linear interpolation between start and end
    for (let j = 0; j <= steps; j++) {
      const x = Math.round(start.x + (dx * j) / steps);
      const y = Math.round(start.y + (dy * j) / steps);

      filled.push({ x, y });
    }
  }

  return filled;
}

export function getStrokeLength(stroke) {
  let len = 0;
  for (let i = 1; i < stroke.length; i++) {
    len += distance(stroke[i - 1], stroke[i]);
  }
  return len;
}
