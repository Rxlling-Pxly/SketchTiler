import Phaser from "../../lib/phaserModule.js";
import Regions from "../1_Sketchpad/strokeToTiles.js";

export default class Demo_Sketch extends Phaser.Scene {
  constructor() {
    super("SketchDemo");
  }

  cellSize = 16; // TODO: this will need correspond to cell size in tilemap/phaser

  // TODO: replace function calls with actual generators
  generator = {
    House: (region) => console.log("TODO: link house generator", region),
    Path: (region) => console.log("TODO: link path generator", region),
    Fence: (region) => console.log("TODO: link fence generator", region),
    Forest: (region) => console.log("TODO: link forest generator", region),
  };

  create() {
    this.gridLines_gfx = this.add.graphics();
    this.fillTiles_gfx = this.add.graphics();

    this.drawGridLines();
    this.structures = {};
    this.genRegions = {};

    // receives sketches from sketch tool
    window.addEventListener("generate", (e) => {
      this.structures = e.detail;
      // TODO: optimize; this.structures is overwritten everytime when we only
      //    really need to add new structures
      const regions = new Regions(this.structures, this.cellSize).get();
      this.generate(regions);
    });

    window.addEventListener("clearSketch", (e) => {
      this.structures = {};
      this.genRegions = {};
      this.fillTiles_gfx.clear();
    });
  }

  // calls generators
  generate(regions) {
    for (let structType in regions) {
      let regionType = this.structures[structType].info.region;
      let color = this.structures[structType].info.color;

      for (let region of regions[structType]) {
        // DEBUG: color generation regions (placeholder visualization -- this will
        //    eventually call structure generators instead!)
        this.fillTiles(region, regionType, color);

        // NOTE: this is where we will call generators
        // `structType` is "House" or "Path" or "Forest" or "Fence"
        // `regionType` is either "box" or trace, and the associated
        //    `region` is either a min/max pair (for box) or
        //    an array of points (for trace)
        this.generator[structType](region);
      }
    }
  }

  /** VIZUALIZERS **/
  // draw a grid
  drawGridLines() {
    this.gridLines_gfx.lineStyle(0.5, 0xffffff, 1);

    let w = window.game.config.width;
    let h = window.game.config.height;

    // vertical lines
    for (let i = this.cellSize; i < w; i += this.cellSize) {
      this.gridLines_gfx.lineBetween(i, 0, i, h);
    }

    // horizontal lines
    for (let j = this.cellSize; j < h; j += this.cellSize) {
      this.gridLines_gfx.lineBetween(0, j, w, j);
    }
  }

  // fill colors
  fillTiles(data, style, color) {
    color = color.replace(/\#/g, "0x"); // make hex-formatted color readable for phaser
    this.fillTiles_gfx.fillStyle(color);
    let sz = this.cellSize;

    // data should have all coords to be filled
    if (style === "trace") {
      for (let i = 0; i < data.length; i++) {
        let { x, y } = data[i];
        this.fillTiles_gfx.fillRect(sz * x, sz * y, sz, sz);
      }
    }
    // data should have {min: {x, y}, max: {x, y}}
    if (style === "box") {
      let { min, max } = data;
      let box = {
        width: Math.max(max.x - min.x, sz),
        height: Math.max(max.y - min.y, sz),
      };

      color = color.replace(/\#/g, "0x"); // make hex-formatted color readable for phaser
      this.fillTiles_gfx.fillStyle(color);
      this.fillTiles_gfx.fillRect(min.x, min.y, box.width, box.height);
    }
  }
}
