import Phaser from "../../lib/phaserModule.js";
import TILEMAP from "./tilemap.js";
import WFCModel from "../2_WFC/1_Model/wfcModel.js";
import IMAGES from "../2_WFC/2_Input/images.js";
import generateHouse from "../3_Generators/generateHouse.js";
import generateForest from "../3_Generators/generateForest.js";
import generateFence from "../3_Generators/generateFence.js";
import generatePath from "../3_Generators/generatePath.js";
import { Regions } from "../1_Sketchpad/1_Classes/regions.js";
import { exportSketch } from "../1_Sketchpad/sketchpad.js";
import generateLayout from "../3_Generators/generateLayout.js";
import STRUCTURE_TILES from "./structureTiles.js";

// hide demo elements
document.getElementById("wfc-demo").classList.add("hidden");
document.getElementById("pattern-panel").classList.add("hidden");

const SUGGESTED_TILE_ALPHA = 0.5;  // must be between 0 and 1
const tilesetInfo = TILEMAP["tiny_town"];

export default class Autotiler extends Phaser.Scene {
  constructor() {
    super("autotilerScene");
  }

  preload() {
    this.load.setPath("./assets/");
    this.load.image("tilemap", "tinyTown_Tilemap_Packed.png");
    this.load.tilemapTiledJSON("tinyTownMap", `maps/map1.tmj`);
  }

  create() {
    this.height = tilesetInfo.HEIGHT;
    this.width = tilesetInfo.WIDTH;
    this.tileSize = tilesetInfo.TILE_WIDTH;

    this.multiLayerMap = this.add.tilemap("tinyTownMap", this.tileSize, this.tileSize, 40, 25);
    this.tileset = this.multiLayerMap.addTilesetImage("kenney-tiny-town", "tilemap");

    this.groundModel = new WFCModel().learn(IMAGES.GROUND, 2);
    this.structsModel = new WFCModel().learn([...IMAGES.STRUCTURES, ...IMAGES.HOUSES], 2);

    this.generator = {
      house: (structure) => generateHouse(structure.boundingBox),
      path: (structure) => generatePath(structure),
      fence: (structure) => generateFence(structure.boundingBox),
      forest: (structure) => generateForest(structure.boundingBox)
    };

    // exports
    this.exportMapButton = document.getElementById("export-map-button");
    this.exportMapButton.addEventListener("click", async () => this.export("map"));
    this.exportMapButton.disabled = true;

    window.addEventListener("generate", (e) => {
      this.sketch = e.detail.sketch;
      this.structures = e.detail.structures;
      this.regions = new Regions(this.sketch, this.structures, this.tileSize).get();

      this.createGroundMap()
      const result = this.generate(this.regions);

      if (result) {
        this.displayMap("structsMap", result, "tilemap");
      }
    });

    window.addEventListener("clearSketch", (e) => {
      //const sketchImage = Array.from({ length: tilesetInfo.HEIGHT }, () => Array(tilesetInfo.WIDTH).fill(0));  // 2D array of all 0s
      //console.log("Clearing sketch data");
      //this.structsModel.clearSetTiles();
      // this.exportMapButton.disabled = true;
    });

    window.addEventListener("undoSketch", (e) => {
      //console.log("TODO: implement undo functionality");
    });

    window.addEventListener("redoSketch", (e) => {
      //console.log("TODO: implement redo functionality");
    });
  }

  // calls generators
  generate(regions, sketchImage) {
    // Try standard generation first (all structures together)
    let layout = generateLayout(
      regions,
      "tiny_town",
      "color_blocks",
      2,
      true
    );

    // Fallback: If standard generation failed (likely due to contradiction), try layered generation
    if (!layout) {
      console.warn("Contradiction detected in standard generation. Attempting layered generation...");
      layout = this.generateLayered(regions);
    }

    if (!layout) return null;

    // call structure generators on each region in completed layout
    let map = this.generateTilemapFromLayout(layout);

    // return completed tilemap
    return map;
  }

  generateLayered(regions) {
    // Define layers: Bottom (Background) -> Top (Foreground)
    // needsFilter: whether to filter training data (only needed when the layer's types are rare in training data)
    const layers = [
      { types: ['fence', 'path'],    needsFilter: true  },   // Bottom layer — sparse in training data
      { types: ['house', 'forest'],  needsFilter: false },   // Top layer — abundant in training data
    ];

    let combinedWorldFacts = [];
    let success = false;

    for (const layer of layers) {
      const layerTypes = layer.types;

      // Filter regions that match this layer's types
      const layerRegions = {};
      let hasRegions = false;

      for (const type in regions) {
        if (layerTypes.includes(type.toLowerCase())) {
          layerRegions[type] = regions[type];
          hasRegions = true;
        }
      }

      // Skip layer if no user regions present (avoids unconstrained generation)
      if (!hasRegions) continue;

      // Retry this layer multiple times before giving up
      let layout = null;
      const maxLayerAttempts = 3;
      for (let attempt = 1; attempt <= maxLayerAttempts; attempt++) {
        layout = generateLayout(
          layerRegions,
          "tiny_town",
          "color_blocks",
          2,
          true,
          layer.needsFilter ? layerTypes : null
        );
        if (layout) break;
        console.warn(`Layer [${layerTypes.join(', ')}] attempt ${attempt}/${maxLayerAttempts} failed, retrying...`);
      }

      if (layout) {
        success = true;
        // Filter facts to only keep types relevant to this layer
        // This prevents layers from hallucinating structures belonging to other layers
        const validFacts = layout.worldFacts.filter(fact =>
          layerTypes.includes(fact.type.toLowerCase())
        );
        combinedWorldFacts.push(...validFacts);
      } else {
        // Fallback: create worldFacts directly from user-drawn regions
        // This handles cases where training data is too sparse for WFC to learn the layer's patterns
        console.warn(`Layer [${layerTypes.join(', ')}] WFC failed, using user regions directly as fallback.`);
        const fallbackFacts = this.createWorldFactsFromRegions(layerRegions);
        if (fallbackFacts.length > 0) {
          success = true;
          combinedWorldFacts.push(...fallbackFacts);
        }
      }
    }

    if (!success) return null;

    // Return a composite layout object
    return {
      worldFacts: combinedWorldFacts
    };
  }

  /**
   * Create worldFacts directly from user-drawn regions (fallback when WFC layout generation fails).
   * @param {Record<string, any[]>} regions - User-drawn regions keyed by structure type.
   * @returns {object[]} Array of worldFact objects.
   */
  createWorldFactsFromRegions(regions) {
    const structureDefs = STRUCTURE_TILES["tiny_town"];
    const facts = [];

    for (const type in regions) {
      const typeLower = type.toLowerCase();
      const config = structureDefs[typeLower];
      if (!config) continue;

      for (const region of regions[type]) {
        if (Array.isArray(region)) {
          // Trace type (e.g., path): region is an array of {x, y} points
          if (region.length === 0) continue;

          let minX = region[0].x, maxX = region[0].x;
          let minY = region[0].y, maxY = region[0].y;
          for (const p of region) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }

          facts.push({
            type: typeLower,
            boundingBox: {
              topLeft: { x: minX, y: minY },
              width: 1 + maxX - minX,
              height: 1 + maxY - minY
            },
            color: config.color,
            trace: region
          });
        } else {
          // Box type (e.g., fence, house, forest): region is a bounding box object
          facts.push({
            type: typeLower,
            boundingBox: {
              topLeft: { x: region.topLeft.x, y: region.topLeft.y },
              width: region.width,
              height: region.height
            },
            color: config.color
          });
        }
      }
    }

    return facts;
  }

  createGroundMap() {
    const image = this.groundModel.generate(tilesetInfo.WIDTH, tilesetInfo.HEIGHT, 10, false, false);
    if (!image) throw new Error("Contradiction created");

    if (this.groundMap) this.groundMap.destroy();
    this.groundMap = this.make.tilemap({
      data: image,
      tileWidth: this.tileSize,
      tileHeight: this.tileSize
    });
    this.groundMap.createLayer(0, this.tileset, 0, 0);

    this.groundImage = image;   // for exports
  }

  /**
   * Display a 2D tiles array as a Phaser Tilemap.
   * 
   * @param {string} mapKey - Instance key used to store tilemap references on this scene.
   * @param {number[][]} tilesArray - 2D array of tile IDs.
   * @param {string} tilesetName - Tileset key loaded in Phaser.
   * @param {number} [gid=1] - Tile ID offset (firstgid).
   */
  displayMap(mapKey, tilesArray, tilesetName, gid = 1) {
    if (this[mapKey]) {
      this[mapKey].removeAllLayers();
      this[mapKey].destroy();
      this[mapKey] = null;
    }

    this[mapKey] = this.make.tilemap({ // make a new tilemap using tiles array
      data: tilesArray,
      tileWidth: this.tileSize,
      tileHeight: this.tileSize
    });

    // make a layer to make new map visible
    let tileset = this[mapKey].addTilesetImage("tileset", tilesetName, 16, 16, 0, 0, gid);
    this[mapKey].createLayer(0, tileset, 0, 0, 1);
  }

  async exportMap(zip) {
    // add map data to the zip
    zip.file("tilemapData.json", JSON.stringify({
      ground: this.convertToSignedArray(this.groundImage),
      structures: this.convertToSignedArray(this.exportImage)
    }));

    // make suggestions full opacity
    this.suggestionsLayer.setAlpha(1);

    // slight pause so canvas snapshot (below) reflects full opacity suggestions
    await new Promise(resolve => setTimeout(resolve, 10));

    // add map image to the zip
    const canvas = window.game.canvas;
    const dataURL = canvas.toDataURL("image/PNG")
    const base64Data = dataURL.replace(/^data:image\/(png|jpg);base64,/, "");

    zip.file("tilemapImage.png", base64Data, { base64: true });

    this.exportMapButton.disabled = true;
  }

  async export(key) {
    const zip = JSZip();

    switch (key) {
      case "map":
        await this.exportMap(zip);
        break;
      case "all":
        await this.exportMap(zip);
        await exportSketch(zip);
        break;
    }

    // generate zip
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `sketchtiler_export_${key}.zip`);
  }

  // converts unsigned ints back to signed 
  convertToSignedArray(arr) {
    let signed2D = arr.map(row =>
      row.map(v => v | 0)   // force into signed 32-bit space
    );

    return signed2D;
  }

  /**
  * Build a full tilemap from a generated layout.
  * Calls structure generator for each structure in the layout, then places them in a 2D array.
  * 
  * @param {Layout} layout - Layout object containing world facts and regions.
  * @returns {number[][]} Generated tilemap.
  */
  generateTilemapFromLayout(layout) {
    let tilemapImage = Array.from({ length: this.height }, () => Array(this.width).fill(-1)); // empty map

    // Get priority for a structure type (higher number = drawn on top)
    const getPriority = (type) => {
      const info = STRUCTURE_TILES["tiny_town"][type];
      return info && info.priority != null ? info.priority : 0;
    };

    // Sort structures: high priority first.
    const sortedFacts = [...layout.worldFacts].sort(
      (a, b) => getPriority(b.type) - getPriority(a.type)
    );

    // Pre-trim regions so lower-priority boxes do not overlap higher-priority boxes.
    const trimmedFacts = this.trimOverlappingFacts(sortedFacts);

    console.log(
      "worldFacts (trimmed):",
      trimmedFacts.map(
        f => `${f.type} (${f.boundingBox.width}x${f.boundingBox.height} at ${f.boundingBox.topLeft.x},${f.boundingBox.topLeft.y})`
      )
    );

    // Ownership map: tracks whether a cell is already claimed by any structure
    const owned = Array.from({ length: this.height }, () => Array(this.width).fill(false));

    // Generate and place structures (high priority first, they claim cells)
    for (let structure of trimmedFacts) {
      let region = structure.boundingBox;

      // Retry individual structure generation up to 3 times
      let gen = null;
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        gen = this.generator[structure.type](structure);
        if (gen) break;
        console.warn(`Structure ${structure.type} at (${region.topLeft.x}, ${region.topLeft.y}) attempt ${attempt}/${maxRetries} failed, retrying...`);
      }

      if (!gen) {
        console.warn(`Structure generation failed after ${maxRetries} attempts: ${structure.type} at (${region.topLeft.x}, ${region.topLeft.y})`);
        continue;
      }

      for (let y = 0; y < region.height; y++) {
        for (let x = 0; x < region.width; x++) {
          let dy = region.topLeft.y + y;
          let dx = region.topLeft.x + x;

          if (dy < 0 || dy >= this.height || dx < 0 || dx >= this.width) continue;

          // Skip void tiles so they don't erase existing content
          if (gen[y][x] === -1) continue;

          // Skip if this cell is already claimed by another structure
          if (owned[dy][dx]) continue;

          tilemapImage[dy][dx] = gen[y][x];
          owned[dy][dx] = true;
        }
      }
    }

    return tilemapImage;
  }

  trimOverlappingFacts(sortedFacts) {
    const claimed = Array.from({ length: this.height }, () => Array(this.width).fill(false));
    const result = [];

    for (const fact of sortedFacts) {
      const typeInfo = STRUCTURE_TILES["tiny_town"][fact.type];
      const regionType = typeInfo && typeInfo.regionType ? typeInfo.regionType : "box";
      const factCopy = {
        ...fact,
        boundingBox: { ...fact.boundingBox, topLeft: { ...fact.boundingBox.topLeft } }
      };

      if (regionType === "trace") {
        const trimmedTrace = this.trimTraceAgainstClaimed(factCopy.trace || [], claimed);
        if (trimmedTrace.length === 0) continue;

        factCopy.trace = trimmedTrace;
        const bounds = this.getBoundsFromPoints(trimmedTrace);
        if (!bounds) continue;
        factCopy.boundingBox = bounds;

        for (const p of trimmedTrace) {
          if (this.inBounds(p.x, p.y)) claimed[p.y][p.x] = true;
        }
        result.push(factCopy);
        continue;
      }

      const trimmedBox = this.shrinkBoxToAvoidClaimed(factCopy.boundingBox, claimed);
      if (!trimmedBox) continue;

      factCopy.boundingBox = trimmedBox;
      this.markBoxClaimed(trimmedBox, claimed);
      result.push(factCopy);
    }

    return result;
  }

  trimTraceAgainstClaimed(trace, claimed) {
    return trace.filter(p => this.inBounds(p.x, p.y) && !claimed[p.y][p.x]);
  }

  getBoundsFromPoints(points) {
    if (!points || points.length === 0) return null;

    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    return {
      topLeft: { x: minX, y: minY },
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  markBoxClaimed(box, claimed) {
    for (let y = box.topLeft.y; y < box.topLeft.y + box.height; y++) {
      for (let x = box.topLeft.x; x < box.topLeft.x + box.width; x++) {
        if (this.inBounds(x, y)) claimed[y][x] = true;
      }
    }
  }

  hasClaimedOverlap(box, claimed) {
    for (let y = box.topLeft.y; y < box.topLeft.y + box.height; y++) {
      for (let x = box.topLeft.x; x < box.topLeft.x + box.width; x++) {
        if (this.inBounds(x, y) && claimed[y][x]) return true;
      }
    }
    return false;
  }

  countClaimedOnEdge(box, claimed, edge) {
    let count = 0;

    if (edge === "left" || edge === "right") {
      const x = edge === "left" ? box.topLeft.x : box.topLeft.x + box.width - 1;
      for (let y = box.topLeft.y; y < box.topLeft.y + box.height; y++) {
        if (this.inBounds(x, y) && claimed[y][x]) count++;
      }
      return count;
    }

    const y = edge === "top" ? box.topLeft.y : box.topLeft.y + box.height - 1;
    for (let x = box.topLeft.x; x < box.topLeft.x + box.width; x++) {
      if (this.inBounds(x, y) && claimed[y][x]) count++;
    }
    return count;
  }

  shrinkBoxToAvoidClaimed(box, claimed) {
    const current = {
      topLeft: { x: box.topLeft.x, y: box.topLeft.y },
      width: box.width,
      height: box.height
    };

    const clampX0 = Math.max(0, current.topLeft.x);
    const clampY0 = Math.max(0, current.topLeft.y);
    const clampX1 = Math.min(this.width - 1, current.topLeft.x + current.width - 1);
    const clampY1 = Math.min(this.height - 1, current.topLeft.y + current.height - 1);
    current.topLeft.x = clampX0;
    current.topLeft.y = clampY0;
    current.width = clampX1 - clampX0 + 1;
    current.height = clampY1 - clampY0 + 1;

    if (current.width <= 0 || current.height <= 0) return null;

    const maxSteps = this.width + this.height;
    let steps = 0;

    while (this.hasClaimedOverlap(current, claimed) && steps < maxSteps) {
      if (current.width <= 1 || current.height <= 1) return null;

      const edges = [
        { edge: "left", overlap: this.countClaimedOnEdge(current, claimed, "left") },
        { edge: "right", overlap: this.countClaimedOnEdge(current, claimed, "right") },
        { edge: "top", overlap: this.countClaimedOnEdge(current, claimed, "top") },
        { edge: "bottom", overlap: this.countClaimedOnEdge(current, claimed, "bottom") },
      ];

      edges.sort((a, b) => b.overlap - a.overlap);
      const chosen = edges[0].edge;

      if (chosen === "left") {
        current.topLeft.x += 1;
        current.width -= 1;
      } else if (chosen === "right") {
        current.width -= 1;
      } else if (chosen === "top") {
        current.topLeft.y += 1;
        current.height -= 1;
      } else {
        current.height -= 1;
      }

      steps++;
    }

    if (current.width <= 0 || current.height <= 0) return null;
    return current;
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}
