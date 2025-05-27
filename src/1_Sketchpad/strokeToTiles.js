import { getBoundingBox, getTrace, isClosed } from "./strokeUtils.js";
import { findShapes, groupNearbyStrokes } from "./strokeGrouping.js";

export class Regions {
  constructor(sketch, structures, cellSize) {
    this.cellSize = cellSize;
    this.regionBlock = {
      box: (strokes) => getBoundingBox(this.pointsToCells(strokes)),
      trace: (strokes) => getTrace(this.pointsToCells(strokes)),
    };

    this.structureSketches = { lastIndex: -1 };
    for (const type in structures) {
      this.structureSketches[type] = {
        info: structures[type],
        strokes: [],
      };
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
        const shapes = findShapes(struct.strokes);
        let closed = shapes.closed;
        let open = shapes.open;
        if (open.length > 0)
          open = open.filter((group) => isClosed(group.flat()));

        struct.strokes = closed.concat(open);

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
  updateStructureSketchHistory(displayList) {
    // only add new strokes (added since last generation call)
    for (
      let i = this.structureSketches.lastIndex + 1;
      i < displayList.length;
      i++
    ) {
      let stroke = displayList[i].line;
      // ignore invis "strokes" and non-structure strokes
      if (stroke.points.length > 1 && stroke.structure) {
        this.structureSketches[stroke.structure].strokes.push(stroke.points);
      }
    }

    this.structureSketches.lastIndex = displayList.length - 1;
  }

  // clears drawn points from structure history
  clearStructureSketchHistory() {
    for (let s in structureSketches) {
      if (structureSketches[s].strokes) {
        structureSketches[s].strokes = [];
      }
    }
    structureSketches.lastIndex = -1;
  }

  // converts canvas coordinates to grid cells
  pointsToCells(strokes) {
    let result = [];

    for (let stroke of strokes) {
      for (let point of stroke) {
        result.push(this.getCell(point.x, point.y));
      }
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
