import { getBoundingBox, getStrokeLength } from "./strokeUtils.js";

// takes an array of strokes and combines strokes within a threshold
//    from each other into a single stroke. Returns a new array with
//    grouped strokes.
export function groupNearbyStrokes(strokes, threshold = 40) {
  const visited = new Array(strokes.length).fill(false); // visit flags
  const result = [];

  // BFS
  for (let i = 0; i < strokes.length; i++) {
    if (visited[i]) continue;

    const group = []; // current group
    const queue = [i]; // search queue
    visited[i] = true; // mark index as visited

    while (queue.length > 0) {
      const current = queue.shift();
      group.push(...strokes[current]); // add strokes to current group

      for (let j = 0; j < strokes.length; j++) {
        if (
          !visited[j] &&
          strokesNearby(strokes[current], strokes[j], threshold)
        ) {
          visited[j] = true; // mark index as visited
          queue.push(j); // add nearby stroke to search queue
        }
      }
    }

    result.push(group); // add grouped strokes to array
  }

  return result;
}

// checks if strokeA and strokeB are within threshold of one another
export function strokesNearby(strokeA, strokeB, threshold) {
  // ignore closed shapes
  if (
    (strokeA.length > 50 && isClosed(strokeA)) ||
    (strokeA.length > 50 && isClosed(strokeB))
  ) {
    return false;
  }

  const boxA = getBoundingBox(strokeA);
  const boxB = getBoundingBox(strokeB);

  return (
    boxA.topLeft.x - threshold < boxB.bottomRight.x &&
    boxA.bottomRight.x + threshold > boxB.topLeft.x &&
    boxA.topLeft.y - threshold < boxB.bottomRight.y &&
    boxA.bottomRight.y + threshold > boxB.topLeft.y
  );
}

// like groupNearbyStrokes() but it's actively tryting to find a shape out of strokes
export function findShapes(allStrokes) {
  let closedShapes = [];
  let openShapes = [];

  let visited = new Set();
  for (let stroke of allStrokes) {
    if (visited.has(stroke)) {
      continue;
    }

    let shape = [stroke];
    visited.add(stroke);

    let current = { stroke: stroke };
    let loopClosed = false;

    while (!loopClosed) {
      let next = findBestConnectingStroke(current, allStrokes, visited);

      if (!next.stroke) {
        break;
      } // dead end (maybe noise or open structure)

      shape.push(next.stroke);
      visited.add(next.stroke);

      if (connectsToStart(next, shape[0])) {
        loopClosed = true;
        break;
      }

      current = next;
    }

    if (loopClosed) {
      closedShapes.push(shape);
    } else {
      openShapes.push(shape);
    }
  }

  return {
    closed: closedShapes,
    open: openShapes,
  };
}

function findBestConnectingStroke(
  current,
  allStrokes,
  visited,
  angleThreshold = Math.PI
) {
  const currentEnd = current.stroke[current.stroke.length - 1];
  const currentStart = current.stroke[0];
  const currentVec = {
    x: currentEnd.x - currentStart.x,
    y: currentEnd.y - currentStart.y,
  };

  let bestCandidate = null;
  let bestScore = Infinity;
  let endPoint;

  for (let candidate of allStrokes) {
    if (visited.has(candidate) || candidate === current) {
      continue;
    }

    // set adaptive threshold
    const currentLen = getStrokeLength(current);
    const candidateLen = getStrokeLength(candidate);
    const adaptiveThreshold = 0.25 * (currentLen + candidateLen);

    const candStart = candidate[0];
    const candEnd = candidate[candidate.length - 1];

    // check if either endpoint is close to currentEnd
    const d1 = distance(currentEnd, candStart);
    const d2 = distance(currentEnd, candEnd);
    const bestDist = Math.min(d1, d2);

    if (bestDist > adaptiveThreshold) continue;

    // record which endpoint we're using
    endPoint = d1 === bestDist ? "start" : "end";

    // form a vector
    let candidateVec =
      endPoint === "start"
        ? { x: candidate[1].x - candStart.x, y: candidate[1].y - candStart.y }
        : {
            x: candidate[candidate.length - 2].x - candEnd.x,
            y: candidate[candidate.length - 2].y - candEnd.y,
          };

    const angle = angleBetween(currentVec, candidateVec);

    // look for smallest angle and distance between current and candidate
    if (angle < angleThreshold) {
      const score = angle + bestDist * 0.1; // composite score: prioritize angle, then distance
      if (score < bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }
  }

  return {
    stroke: bestCandidate, // candidate with smalles angle/distance from current
    endPoint: endPoint, // which endpoint we compared to current's ends
  };
}

function connectsToStart(current, start) {
  const strokeEnd =
    current.endPoint === "start"
      ? current.stroke[current.stroke.length - 1]
      : current.stroke[0];
  const shapeEnds = [start[0], start[start.length - 1]];

  // calculate average length of both strokes
  const lenA = getStrokeLength(current.stroke);
  const lenB = getStrokeLength(start);
  const adaptiveThreshold = 0.25 * (lenA + lenB);

  for (let pt of shapeEnds) {
    if (distance(strokeEnd, pt) < adaptiveThreshold) return true;
  }
  return false;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(v1, v2) {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  return Math.acos(dot / (mag1 * mag2));
}
