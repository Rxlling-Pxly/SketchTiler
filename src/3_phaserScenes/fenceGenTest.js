import Phaser from "../../lib/phaserModule.js"
import FenceGenerator from "../1_generators/fenceGenerator.js";

export default class FenceGenTest extends Phaser.Scene {
    coordsArray = [{x: 5, y: 10}, {x: 4, y: 10}, {x: 4, y: 9}];
    generator = new FenceGenerator(coordsArray);
    tilemapArray = [];

    constructor() {
		super("wfcTestingScene");
	}

	preload() {
		this.load.setPath("./assets/");
		this.load.image("tilemap", "tinyTown_Tilemap_Packed.png");
	}

	create() {
        for (let i = 0; i < 10; i++) {
            this.tilemapArray.push([]);
            for (let j = 0; j < 10; j++)  {
                this.tilemapArray[i].push([0]);
                for (let n = 0; n < this.generator.tileArray.length; n++) {
                    if (this.tileArray[n].x == j && this.coordsArray[n].y == i) {
                        this.tilemapArray[i][j] = this.generator.tileArray
                    }
                }
            }
        }
	}

    displayMap(structuresImage) {
		if (this.structuresMap) this.structuresMap.destroy();

		this.structuresMap = this.make.tilemap({
			data: this.generator.tileArray,
			tileWidth: 16,
			tileHeight: 16
		});
		
		this.structuresMap.createLayer(0, this.tileset, 0, 0);
	}
}