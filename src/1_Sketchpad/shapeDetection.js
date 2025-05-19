import { ramerDouglasPeucker } from "./lineCleanup.js";

/* SHAPE DETECTION */
export function redrawShape(name, data){
}

export function getShape(pts){
    let name;
    let points;

    const circle = isCircle(pts);
    const rect = (circle) ? null : isRect(pts); // only checking if stroke is not a circle
    const tri = (circle || rect) ? null : isTriangle(pts); // ... ^

    if(circle){
        name = "circle"; 
        points = circle;
    }
    else if(rect){
        name = "rect";
        points = rect;
    }
    else if(tri){
        name = "triangle";
        points = tri;
    }

    if(!name){ return false; }

    return { name: name, points: points }
}

// triangle
function isTriangle(pts){
	if (!isClosed(pts)) return false;
    const anglePts = (pts.length > 5) ? ramerDouglasPeucker(pts, 10) : pts;    // simplify long strokes
    if (countSharpAngles(anglePts) === 3){ 
        return normalizeTriangle(anglePts);
    }
    return false;
}

// rect
function isRect(pts){
	if (!isClosed(pts)) return false;
    const anglePts = (pts.length > 4) ? ramerDouglasPeucker(pts, 10) : pts;    // simplify long strokes
    if (countSharpAngles(anglePts) === 4){ 
        return normalizeRect(anglePts);
    }
    return false;
}

// circle
function isCircle(pts, threshold = 500) {
	if (!isClosed(pts)) return false;

    // reject strokes with too few points
    if (pts.length < 10) return false;

    // reject strokes with too small perimeter
    const totalDist = pts.reduce((sum, p, i) => {
        if (i === 0) return 0;
        const prev = pts[i - 1];
        return sum + Math.hypot(p.x - prev.x, p.y - prev.y);
    }, 0);

    if (totalDist < 100) return false;  

	const center = getCentroid(pts);

	// for each point, compute euclidean distance to the center 
	const distances = pts.map(p => Math.hypot(p.x - center.x, p.y - center.y));
	// calculate average radius
	const avg = distances.reduce((a, b) => a + b, 0) / distances.length; // NOTE TO SELF: i think this value + center can also be used to generate a neat circle using canvas circle method
	// calculate how far each distance is from avg
	const variance = distances.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / distances.length;
  
    // check for sharp angles to prevent squares from being classified as circles
    const anglePts = (pts.length < 50) ? pts : ramerDouglasPeucker(pts, 10);    // simplify larger strokes
    if (countSharpAngles(anglePts) > 2) return false;

	// higher threshold = more sloppiness allowed
	if(variance < threshold){
        // return center and radius if this stroke is a circle
        return normalizeCircle(center, avg);
    } else {
        return false;
    }
}

// helper: adjust points so rect lines are straight 
function normalizeRect(pts){
    const points = [];

    const topLeft = pts.reduce((acc, p) => ({
        x: Math.min(acc.x, p.x),
        y: Math.min(acc.y, p.y)
    }), { x: Infinity, y: Infinity });
      
    const bottomRight = pts.reduce((acc, p) => ({
        x: Math.max(acc.x, p.x),
        y: Math.max(acc.y, p.y)
    }), { x: -Infinity, y: -Infinity });

    points.push(topLeft);                           // top left
    points.push({x: bottomRight.x, y: topLeft.y});  // top right
    points.push(bottomRight);                       // bottom right
    points.push({x: topLeft.x, y: bottomRight.y});  // bottom left
    points.push(topLeft);                           // closes shape

    return points;
}

// helper: TODO
// right now, its just ensures that shape is closed
function normalizeTriangle(pts){
    pts.pop();
    pts.push(pts[0]);
    return pts;
}

// helper: draw a circle around given center, with given radius
// TODO: fix shift bug (on repeat auto-shape clicks, shape scoots to the right???)
function normalizeCircle(center, radius, numPoints = 60) { 
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle)
      });
    }
    points.push(points[0]); // close circle
    return points;
  }
  

// helper: approximates the center of the shape by averaging the x and y values of each point
function getCentroid(pts) {
	const sum = pts.reduce((acc, p) => (
		{ x: acc.x + p.x, y: acc.y + p.y }
	));
	return { x: sum.x / pts.length, y: sum.y / pts.length };
}

// helper: returns whether stroke is closed (end point within threshold from start)
function isClosed(pts, threshold = 60) {
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
  