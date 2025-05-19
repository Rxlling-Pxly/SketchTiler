import Phaser from "../../lib/PhaserModule.js";
import TILEMAP from "./TILEMAP.js";
import Autotiler from "./Autotiler.js";
//import Demo_Sketch from "./Demo_Sketch.js";
//import Demo_WFC from "./Demo_WFC.js";
//import HouseDataMiner from "../5_Utility/HouseDataMiner.js";
//import HouseDataMiner2 from "../5_Utility/HouseDataMiner2.js";
//import TilemapDataMiner from "../5_Utility/tilemapDataMiner.js";

export default function initPhaser() {
  window.game = new Phaser.Game({
    parent: "phaser",
    type: Phaser.CANVAS,
    width: TILEMAP.WIDTH * TILEMAP.TILE_WIDTH,
    height: TILEMAP.HEIGHT * TILEMAP.TILE_WIDTH,
    zoom: 1,
    //autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,	// comment out this line to not center
    //backgroundColor: "#ebebeb",
    render: { pixelArt: true },	// scale pixel art without blurring
    scene: [Autotiler]
  });
}