import { isClosed, isOverlapped } from "./tileUtils.js";

export class Regions {
  regionBlock = {
    box: (strokes) => this.getBoundingBox(strokes),
    trace: (strokes) => this.getTrace(strokes),
  };

  structureSketches = { lastIndex: -1 }

  constructor(sketch, structures, cellSize) {
    this.cellSize = cellSize;

    for (const type in structures) {
      this.structureSketches[type] = {
        info: structures[type],
        strokes: []
      }
    }

    this.updateStructureSketchHistory(sketch);
    this.sketch = this.structureSketches;

  }

  // returns an object 
  //    properties  --> structure types               
  //    values      --> array of each structure's strokes 
  get() {
    let result = {};

    for (let structType in this.sketch) {
      let struct = this.sketch[structType];

      // only looking through structures (not other attributes) with points drawn
      if (struct.info && struct.strokes && struct.strokes.length > 0) {
        result[structType] = [];
        let regionType = struct.info.regionType;

        // group nearby strokes into a single stroke before defining region
        struct.strokes = this.groupNearbyStrokes(struct.strokes);

        // TODO: LEFT OFF HERE!!!
        // once strokes have been grouped, see if any shapes need to be grouped
        // *** two neighboring houses should not condense into a single mansion ***

        // define regions (box or trace) for every stroke of this structure
        for (let stroke of struct.strokes) {
          result[structType].push(
            this.regionBlock[regionType](stroke, struct.info.color)
          );
        }
      }
    }

    return result;
  }

  //* STRUCTURES ORGANIZATION *//
  // organize displayList by structure,
    updateStructureSketchHistory(displayList){
      // only add new strokes (added since last generation call)
      for(let i = this.structureSketches.lastIndex + 1; i < displayList.length; i++){
        let stroke = displayList[i].line;
          // ignore invis "strokes" and non-structure strokes
        if(stroke.points.length > 1 && stroke.structure){ 
          this.structureSketches[stroke.structure].strokes.push(stroke.points);
        }
      }

      this.structureSketches.lastIndex = displayList.length - 1;
    }

  // clears drawn points from structure history
  clearStructureSketchHistory(){
    for(let s in structureSketches){
      if(structureSketches[s].strokes){ 
        structureSketches[s].strokes = []; 
      }
    }
    structureSketches.lastIndex = -1;

  }

  // takes an array of strokes and combines strokes within a threshold 
  //    from each other into a single stroke. Returns a new array with
  //    grouped strokes.
  groupNearbyStrokes(strokes, threshold = 2) {
    const visited = new Array(strokes.length).fill(false);  // visit flags
    const result = [];

    // BFS
    for (let i = 0; i < strokes.length; i++) {
      if (visited[i]) continue;

      const group = [];     // current group
      const queue = [i];    // search queue
      visited[i] = true;    // mark index as visited

      while (queue.length > 0) {
        const current = queue.shift();
        group.push(...strokes[current]);    // add strokes to current group

        for (let j = 0; j < strokes.length; j++) {
          if (
            !visited[j] &&
            this.strokesNearby(strokes[current], strokes[j], threshold)
          ) {
            visited[j] = true;  // mark index as visited
            queue.push(j);      // add nearby stroke to search queue
          }
        }
      }

      result.push(group);       // add grouped strokes to array
    }

    return result;
  }

  // checks if strokeA and strokeB are within threshold of one another
  strokesNearby(strokeA, strokeB, threshold) {
    if(isClosed(strokeA) || isClosed(strokeB)) return false;  // ignore closed shapes
    const boxA = this.getBoundingBox(strokeA);
    const boxB = this.getBoundingBox(strokeB);

    /*
    if(!isOverlapped(boxA, boxB, threshold)){ // TEMP ??????????
      // if the strokes arent overlapping, check whether both are closed
      if(isClosed(strokeA) && isClosed(strokeB)) return false;    // TEMP
    } else {
      // if the strokes are overlapping, then they are considered nearby
      // TODO:
      //  might need to do additional checks here. 
      //    > are the regions overlapping on purpose?
      //    > how to determine, if both strokes are closed, user intent????  
      return true;
    }
    */

    return (
      boxA.topLeft.x - threshold < boxB.bottomRight.x &&
      boxA.bottomRight.x + threshold > boxB.topLeft.x &&
      boxA.topLeft.y - threshold < boxB.bottomRight.y &&
      boxA.bottomRight.y + threshold > boxB.topLeft.y
    );
  }

  // for "box" region types
  //    gets min x,y and max x,y of stroke to create a bounding bow region around stroke
  getBoundingBox(stroke) {
    if (!stroke) return;
    // console.log("getting bounding box...", stroke)
    const outputWidth = window.game.config.width / this.cellSize;
    const outputHeight = window.game.config.height / this.cellSize;

    let tiles = this.pointsToCells(stroke);

    // get top-left and bottom-right of stroke and fill in that region of tiles
    let topLeft = { x: outputWidth, y: outputHeight };
    let bottomRight = { x: -1, y: -1 };
    for (let tile of tiles) {
      // top-left
      if (tile.x < topLeft.x) {
        topLeft.x = tile.x;
      }
      if (tile.y < topLeft.y) {
        topLeft.y = tile.y;
      }

      // bottom-right
      if (tile.x > bottomRight.x) {
        bottomRight.x = tile.x;
      }
      if (tile.y > bottomRight.y) {
        bottomRight.y = tile.y;
      }
    }

    return {
      topLeft: topLeft,
      bottomRight: bottomRight,
      width: 1 + bottomRight.x - topLeft.x,
      height: 1 + bottomRight.y - topLeft.y
    };
  }

  // for "trace" region types
  //    returns an array of the the grid cells that stroke points pass through
  getTrace(stroke) {
    if (!stroke) return;
    console.log("getting region trace...", stroke);

    let result = this.pointsToCells(stroke);

    // normalized squares, triangles will have very few points.
    //    need to fill in-between tiles in these cases
    if (result.length < 5) {
      result = this.completeShape(result);
    }

    return result;
  }

  // uses linear interpolation to fill empty cells in shapes with few points 
  //    prevents squares, triangles, etc from being represented as just their angle points
  completeShape(points) {
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

  // converts canvas coordinates to grid cells
  pointsToCells(stroke) {
    let result = [];

    for (let point of stroke) {
      //console.log(getCell(point.x, point.y))
      result.push(this.getCell(point.x, point.y));
    }

    result = this.removeDuplicates(result);
    return result;
  }

  // finds which cell the point is in
  getCell(x, y) {
    return {
      x: Math.floor(x / this.cellSize),
      y: Math.floor(y / this.cellSize),
    };
  }

  // removes duplicates for array
  removeDuplicates(arr) {
    const uniqueArray = Array.from(
      new Set(arr.map((obj) => JSON.stringify(obj)))
    ).map((str) => JSON.parse(str));

    return uniqueArray;
  }
}
