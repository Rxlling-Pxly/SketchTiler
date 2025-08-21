import Phaser from "../../lib/phaserModule.js";
import TILEMAP from "./TILEMAP.js";
import WFCModel from "../2_WFC/1_Model/WFCModel.js";
import IMAGES from "../2_WFC/2_Input/IMAGES.js";
import generateHouse from "../3_Generators/generateHouse.js";
import generateForest from "../3_Generators/generateForest.js";
import { Regions } from "../1_Sketchpad/1_Classes/regions.js";

const SUGGESTED_TILE_ALPHA = 0.5;  // must be between 0 and 1

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
    this.multiLayerMap = this.add.tilemap("tinyTownMap", TILEMAP.TILE_WIDTH, TILEMAP.TILE_WIDTH, 40, 25);
    this.tileset = this.multiLayerMap.addTilesetImage("kenney-tiny-town", "tilemap");

    this.groundModel = new WFCModel().learn(IMAGES.GROUND, 2);
    this.structsModel = new WFCModel().learn([...IMAGES.STRUCTURES, ...IMAGES.HOUSES], 2);

    this.generator = {
      House: (region) => generateHouse({width: region.width, height: region.height}),
      Path: (region) => console.log("TODO: link path generator", region),
      Fence: (region) => console.log("TODO: link fence generator", region),
      Forest: (region) => generateForest({width: region.width, height: region.height})
    };

    window.addEventListener("generate", (e) => {
      this.sketch = e.detail.sketch;
      this.structures = e.detail.structures;
      this.regions = new Regions(this.sketch, this.structures, TILEMAP.TILE_WIDTH).get();

      const sketchImage = Array.from({ length: TILEMAP.HEIGHT }, () => Array(TILEMAP.WIDTH).fill(0));  // 2D array of all 0s
      
      this.structsModel.clearSetTiles();
      this.generate(this.regions, sketchImage);
      
      console.log("Structures generated, attempting to generate map suggestions.");
      this.createGroundMap()
      this.createStructsMap_WFC();
      this.createStructsMap_Sketch(sketchImage);

      console.log("Generation Complete");
    });

    window.addEventListener("clearSketch", (e) => {
      //const sketchImage = Array.from({ length: TILEMAP.HEIGHT }, () => Array(TILEMAP.WIDTH).fill(0));  // 2D array of all 0s
      console.log("Clearing sketch data");
      this.structsModel.clearSetTiles();
    });

    window.addEventListener("undoSketch", (e) => {
      console.log("TODO: implement undo functionality");
    });

    window.addEventListener("redoSketch", (e) => {
      console.log("TODO: implement redo functionality");
    });
  }

  // calls generators
  generate(regions, sketchImage) {
    const result = [];
    for (let structType in regions) {
      for (let region of regions[structType]) {
        const gen = this.generator[structType](region);

        if(this.structures[structType].regionType === "box"){
          console.log("Attempting to generate a structure.");
          for (let y = 0; y < region.height; y++) {
          for (let x = 0; x < region.width; x++) {
            const dy = y + region.topLeft.y;
            const dx = x + region.topLeft.x;
            sketchImage[dy][dx] = gen[y][x];
            this.structsModel.setTile(dx, dy, [gen[y][x]]);
          }}
        }

        if(this.structures[structType].regionType === "trace"){
          // TODO: implement trace region placements
        }

      }
    }
    return result;
  }

  createGroundMap() {
      const image = this.groundModel.generate(TILEMAP.WIDTH, TILEMAP.HEIGHT, 10, false, false);
      if (!image) throw new Error("Contradiction created");
      
      if (this.groundMap) this.groundMap.destroy();
      this.groundMap = this.make.tilemap({
        data: image,
        tileWidth: TILEMAP.TILE_WIDTH,
        tileHeight: TILEMAP.TILE_WIDTH
      });
      this.groundMap.createLayer(0, this.tileset, 0, 0);
  }

  createStructsMap_WFC() {
    const image = this.structsModel.generate(TILEMAP.WIDTH, TILEMAP.HEIGHT, 10, true, true);
    if (!image) throw new Error ("Contradiction created");

    if (this.structsMap_WFC) this.structsMap_WFC.destroy();
    this.structsMap_WFC = this.make.tilemap({
      data: image,
      tileWidth: TILEMAP.TILE_WIDTH,
      tileHeight: TILEMAP.TILE_WIDTH
    });
    this.structsMap_WFC.createLayer(0, this.tileset, 0, 0).setAlpha(SUGGESTED_TILE_ALPHA);
  }

  createStructsMap_Sketch(data) {
    if (this.structsMap_Sketch) this.structsMap_Sketch.destroy();
    this.structsMap_Sketch = this.make.tilemap({
      data: data,
      tileWidth: TILEMAP.TILE_WIDTH,
      tileHeight: TILEMAP.TILE_WIDTH
    });
    this.structsMap_Sketch.createLayer(0, this.tileset, 0, 0);
  }
}