// helper: approximates the center of the shape by averaging the x and y values of each point
export function getCentroid(pts) {
	const sum = pts.reduce((acc, p) => (
		{ x: acc.x + p.x, y: acc.y + p.y }
	));
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
    let sharpAngles = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const c = (i === points.length - 1) ? points[1] : points[i + 1]; // wrap if last point
  
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
    const overlapX = Math.min(r1.bottomRight.x, r2.bottomRight.x) - Math.max(r1.topLeft.x, r2.topLeft.x);
    const overlapY = Math.min(r1.bottomRight.y, r2.bottomRight.y) - Math.max(r1.topLeft.y, r2.topLeft.y);

    // If both width and height of the overlapping region exceed the threshold
    return overlapX > t && overlapY > t;
}
