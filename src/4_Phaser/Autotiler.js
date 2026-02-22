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
        this.displayMap(this.structsMap, result, "tilemap");
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
    const layers = [
      ['fence', 'path'],      // Bottom layer
      ['house', 'forest']     // Top layer
    ];

    let combinedWorldFacts = [];
    let success = false;

    for (const layerTypes of layers) {
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
          layerTypes
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
        console.warn(`Layer [${layerTypes.join(', ')}] failed after ${maxLayerAttempts} attempts, skipping.`);
      }
    }

    if (!success) return null;

    // Return a composite layout object
    return {
      worldFacts: combinedWorldFacts
    };
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
   * @param {Phaser.Tilemaps.Tilemap} map - Existing tilemap (will be destroyed and remade).
   * @param {number[][]} tilesArray - 2D array of tile IDs.
   * @param {string} tilesetName - Tileset key loaded in Phaser.
   * @param {number} [gid=1] - Tile ID offset (firstgid).
   */
  displayMap(map, tilesArray, tilesetName, gid = 1) {
    if (map) map.destroy();   // destroy old version of map

    map = this.make.tilemap({ // make a new tilemap using tiles array
      data: tilesArray,
      tileWidth: this.tileSize,
      tileHeight: this.tileSize
    });

    // make a layer to make new map visible
    let tileset = map.addTilesetImage("tileset", tilesetName, 16, 16, 0, 0, gid);
    map.createLayer(0, tileset, 0, 0, 1);
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

    // generate all structures in layout
    for (let structure of layout.worldFacts) {
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
          // place generated structure tiles in tilemapImage
          let dy = region.topLeft.y + y;
          let dx = region.topLeft.x + x;

          tilemapImage[dy][dx] = gen[y][x];
        }
      }
    }

    return tilemapImage;
  }
}