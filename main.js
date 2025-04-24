"use strict"	// execute JS code in strict mode

import Phaser from "./lib/phaserModule.js";
import FenceGenTest from "./src/3_phaserScenes/fenceGenTest.js";
import WFCTesting from "./src/3_phaserScenes/wfcTesting.js";

const config = {
	parent: "phaserCanvas",
	type: Phaser.CANVAS,
	width: 640,		// 40 tiles x 16 pixels each
	height: 400,	// 25 tiles x 16 pixels each
	zoom: 1,
	autoCenter: true,
	render: { pixelArt: true },	// scale pixel art without blurring
	scene: [FenceGenTest]
}

window.game = new Phaser.Game(config);