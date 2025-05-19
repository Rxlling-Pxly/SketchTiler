import Phaser from "../../lib/PhaserModule.js";
import WFCModel from "../2_WFC/1_Model/WFCModel.js";
import IMAGES from "../2_WFC/2_Input/IMAGES.js";
import TILEMAP from "./TILEMAP.js";
import Regions from "../1_Sketchpad/strokeToTiles.js";
import generateHouse from "../3_Generators/generateHouse.js";
import generateForest from "../3_Generators/generateForest.js";
import generatePath from "../3_Generators/generatePath.js";

export default class Autotiler extends Phaser.Scene {
  SUGGESTED_TILE_ALPHA = 0.5;  // must be between 0 and 1

  constructor() {
    super("autotilerScene");
  }

  preload() {
    this.load.setPath("./assets/");
    this.load.image("tileset", "tinyTown_Tilemap_Packed.png");
    this.load.tilemapTiledJSON("tinyTownMap", "maps/map1.tmj");
  }

  create() {
    this.createTileset();

    this.groundModel = new WFCModel().learn(IMAGES.GROUND, 2);
    this.structsModel = new WFCModel().learn([...IMAGES.STRUCTURES, ...IMAGES.HOUSES], 2);  // TODO: figure out why we need to include houses to avoid contradiction

    this.generator = {
      House: (region) => generateHouse({width: region.width, height: region.height}),
      Path: (region) => generatePath(region),
      Fence: (region) => generatePath(region),
      Forest: (region) => generateForest({width: region.width, height: region.height})
    };

    window.addEventListener("generate", (e) => {
      this.structures = e.detail;
      const regions = new Regions(this.structures, 16).get();
      const sketchImage = Array.from({ length: TILEMAP.HEIGHT }, () => Array(TILEMAP.WIDTH).fill(0));  // 2D array of all 0s
      
      this.structsModel.clearSetTiles();
      this.generate(regions, sketchImage);
      
      console.log("Structures generated, attempting to generate map suggestions.");
      this.createGroundMap()
      this.createStructsMap_WFC();
      this.createStructsMap_Sketch(sketchImage);

      console.log("Generation Complete");
    });
  }

  createTileset() {
    /*
      We need to create this.tileset from this.add.tilemap
      as opposed to any of the this.make.tilemap calls that will occur later
      because we need to utilize the embedded tileset in the tmj file (kenney-tiny-town).

      The embedded tileset says that the firstgid is 1.
      Using this.make.tilemap.addTilesetImage("tileset") will make the first tile have an id of 0
      so each tile will appear as the previous tile in the tileset, making every tile appear wrong.
    */
    const map = this.add.tilemap("tinyTownMap", 16, 16, 40, 25);
    this.tileset = map.addTilesetImage("kenney-tiny-town", "tileset");
  }

  generate(regions, sketchImage) {
    for (let structType in regions) {
      for (let region of regions[structType]) {
        const gen = this.generator[structType](region);

        if(this.structures[structType].info.region === "box"){
          console.log("Attempting to generate a structure.");
          for (let y = 0; y < region.height; y++) {
          for (let x = 0; x < region.width; x++) {
            const dy = y + region.topLeft.y;
            const dx = x + region.topLeft.x;
            sketchImage[dy][dx] = gen[y][x];
            this.structsModel.setTile(dx, dy, [gen[y][x]]);
          }}
        }

        if(this.structures[structType].info.region === "trace"){
          const tiles = structType === "Path" ? TILEMAP.PATH_TILES : TILEMAP.FENCE_TILES;
          for (const { x, y } of gen) {
            this.structsModel.setTile(x, y, tiles);
          }
        }
      }
    }
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
    this.groundMap.createLayer(0, this.tileset);
  }

  createStructsMap_WFC() {
    const image = this.structsModel.generate(TILEMAP.WIDTH, TILEMAP.HEIGHT, 10, true, false);
    if (!image) throw new Error ("Contradiction created");

    if (this.structsMap_WFC) this.structsMap_WFC.destroy();
    this.structsMap_WFC = this.make.tilemap({
      data: image,
      tileWidth: TILEMAP.TILE_WIDTH,
      tileHeight: TILEMAP.TILE_WIDTH
    });
    this.structsMap_WFC.createLayer(0, this.tileset).setAlpha(this.SUGGESTED_TILE_ALPHA);
  }

  createStructsMap_Sketch(data) {
    if (this.structsMap_Sketch) this.structsMap_Sketch.destroy();
    this.structsMap_Sketch = this.make.tilemap({
      data: data,
      tileWidth: TILEMAP.TILE_WIDTH,
      tileHeight: TILEMAP.TILE_WIDTH
    });
    this.structsMap_Sketch.createLayer(0, this.tileset);
  }
}