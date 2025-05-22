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
export function isOverlapped(r1, r2, t){
    // check if any of r1's extremeties are inside of r2
    const topRight = {
        x: r1.bottomRight.x,
        y: r1.topLeft.y 
    }
    const bottomLeft = {
        x: r1.topLeft.x,
        y: r1.bottomRight.y
    }

    let extrems = [r1.topLeft, topRight, r1.bottomRight, bottomLeft];

    for(let e of extrems){
        if( e.x > r2.topLeft.x + t && e.x < r2.bottomRight.x - t &&
            e.y > r2.topLeft.y + t && e.y < r2.bottomRight.y - t 
        ){ return true; }
    }

    return false;
}