import { ramerDouglasPeucker } from "./lineCleanup.js";
import { countSharpAngles, isClosed, getCentroid } from "./tileUtils.js";

const sketchCanvas = document.getElementById("sketch-canvas");

/* SHAPE DETECTION */
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

    // snap to canvas bounds
    if(topLeft.x < 0) topLeft.x = 0;
    if(topLeft.y < 0) topLeft.y = 0;
      
    const bottomRight = pts.reduce((acc, p) => ({
        x: Math.max(acc.x, p.x),
        y: Math.max(acc.y, p.y)
    }), { x: -Infinity, y: -Infinity });

    // snap to canvas bounds
    if(bottomRight.x >= sketchCanvas.width-1) bottomRight.x = sketchCanvas.width-1;
    if(bottomRight.y >= sketchCanvas.height-1) bottomRight.y = sketchCanvas.height-1;

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
      let point = {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle)
      }

      // snap to canvas bounds
      if(point.x < 0) point.x = 0;
      else if(point.x >= sketchCanvas.width-1) point.x = sketchCanvas.width-1;
      
      if(point.y < 0) point.y = 0;
      else if(point.y >= sketchCanvas.height-1) point.y = sketchCanvas.height-1;

      points.push(point);
    }
    points.push(points[0]); // close circle
    return points;
  }

  