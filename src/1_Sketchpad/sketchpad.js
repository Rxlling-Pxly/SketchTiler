/**
 * @fileoverview
 * Sketch canvas input handler for a shape-drawing system.
 * Supports drawing, undo/redo history, stroke normalization, and communication with a Phaser scene.
 * 
 * Dependencies:
 * - LineDisplayble, MouseDisplayable (displayables.js)
 * - conf (canvasConfig.js)
 * - normalizeStrokes, inCanvasBounds, showDebugText (canvasUtils.js)
 * - undo, redo, getSnapshot (canvasHistory.js)
 */

import { LineDisplayble, MouseDisplayable } from "./1_Classes/displayables.js";
import { WorkingLine } from "./1_Classes/line.js";
import { conf } from "./2_Utils/canvasConfig.js";
import { normalizeStrokes, inCanvasBounds, screenToPage, showDebugText } from "./2_Utils/canvasUtils.js"
import { undo, redo, getSnapshot } from "./2_Utils/canvasHistory.js"
import TILEMAP from "../4_Phaser/3_Utils/tilemap.js";

const tilesetInfo = TILEMAP["tiny_town"];


// Canvas setup
const sketchCanvas = document.getElementById("sketch-canvas");
const gridCanvas = document.getElementById("grid-canvas");
const ctx = sketchCanvas.getContext("2d");
const gridCtx = gridCanvas.getContext("2d");


/** Current in-progress line. */
let workingLine = new WorkingLine({ 
	points: [], 
	thickness: conf.lineThickness, 
	hue: 0, 
	structure: null,
});

/** Mouse cursor/tool. */ 
let mouseObject = new MouseDisplayable({
	x: 0,
	y: 0,
	hue: 0,
	active: false,
}, conf.lineThickness);

let displayList = [];     // Displayed strokes currently on canvas.
let redoDisplayList = []; // Strokes removed via undo, recorded for redo support

let undoStack = []; // Snapshots of canvas state for undo operations
let redoStack = []; // Snapshots of canvas state for redo operations

let activeButton; // Active structure type selected via button (e.g. 'house', 'tree').

//the zoom scale and offset
let scale = 1.0;
let panX = 0;
let panY = 0;

// Panning variables
let isPanning = false;
let startPanY = 0;
let startPanX = 0;

// Draw the grid with current pan and scale
export function drawGrid() {
	gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
	gridCtx.save();
	gridCtx.translate(panX, panY);
	gridCtx.scale(scale, scale);

	gridCtx.strokeStyle = "#DBDBDB";
	gridCtx.lineWidth = 1; // Keep line width constant ? No, let it scale or not? User said "grid not changing with zooming", typically means checking if it stays 1px or scales. 
	// Usually grid lines should pan and zoom. If we scale the context, they will zoom.
	// If we want constant thickness we would divide lineWidth by scale. But user probably wants them to move with zoom.

	// Draw grid lines covering the entire map area
	const mapWidth = (tilesetInfo.WIDTH + 4) * tilesetInfo.TILE_WIDTH;
	const mapHeight = tilesetInfo.HEIGHT * tilesetInfo.TILE_WIDTH;

	gridCtx.beginPath();
	for (let x = 0; x <= mapWidth; x += tilesetInfo.TILE_WIDTH) {
		gridCtx.moveTo(x, 0);
		gridCtx.lineTo(x, mapHeight);
	}
	for (let y = 0; y <= mapHeight; y += tilesetInfo.TILE_WIDTH) {
		gridCtx.moveTo(0, y);
		gridCtx.lineTo(mapWidth, y);
	}
	gridCtx.stroke();
	gridCtx.restore();
}

// Structure buttons setup
for (const type in conf.structures) {
	const structure = conf.structures[type];
	const button = document.getElementById(`${type.toLowerCase()}-button`);
	if(!button) continue;

	// set activeButton to clicked button and change stroke attributes
	button.onclick = () => {
		mouseObject.mouse.hue = structure.color;
		button.style.borderColor = structure.color;  
		activeButton = type;
	}
}
// Default to 'house' for initial selected marker
document.getElementById("house-button").click(); 

// Prevent context menu from appearing on right click
sketchCanvas.addEventListener("contextmenu", (e) => e.preventDefault());


// Custom event for repainting the canvas after changes.
const changeDraw = new Event("drawing-changed"); 
sketchCanvas.addEventListener("drawing-changed", () => {
	ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
	
	//adding the scle and pan from the zoom
	ctx.save();
	ctx.translate(panX, panY);
	ctx.scale(scale, scale);
	
	for (const d of displayList) 
		d.display(ctx);

	ctx.restore();
});

// Custom event for updating the mouse tool position.
const movedTool = new Event("tool-moved");
sketchCanvas.addEventListener("tool-moved", () => {
	ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);

	ctx.save();
	ctx.translate(panX, panY);
	ctx.scale(scale, scale);

	for (const d of displayList) 
		d.display(ctx);

	ctx.restore();
	mouseObject.display(ctx);
});

// Start drawing a new stroke.
sketchCanvas.addEventListener("mousedown", (ev) => {
	
	if (ev.button == 2) {
		isPanning = true;
		startPanX = ev.clientX - panX;
		startPanY = ev.clientY - panY;
		sketchCanvas.style.cursor = "grabbing";

		mouseObject = new MouseDisplayable({
			x: -1,
			y: -1,
			hue: mouseObject.mouse.hue,
			active: false,
		}, 0);

		return;
	}

	//Page coords
	const pageCoords = screenToPage(ev.offsetX, ev.offsetY, panX, panY, scale);

	// Bounds check using page coordinates against the map size
	const mapWidth = (tilesetInfo.WIDTH + 4) * tilesetInfo.TILE_WIDTH;
	const mapHeight = tilesetInfo.HEIGHT * tilesetInfo.TILE_WIDTH;

	if (pageCoords.x < 0 || pageCoords.x > mapWidth || pageCoords.y < 0 || pageCoords.y > mapHeight) {
		return; // Click outside map bounds
	}

	// Update cursor
	mouseObject = new MouseDisplayable({
		x: ev.offsetX,
		y: ev.offsetY,
		hue: mouseObject.mouse.hue,
		active: true,
	}, conf.lineThickness);

	undoStack.push(getSnapshot());

	workingLine = {
		points: [pageCoords],
		thickness: conf.lineThickness,
		hue: mouseObject.mouse.hue,
		structure: activeButton,
	};

	// add working line to displayList
	displayList.push(new LineDisplayble(workingLine)); 

	// clear redo history
	redoDisplayList = [];

	// redraw canvas with new stroke + cursor position
	sketchCanvas.dispatchEvent(changeDraw);
	sketchCanvas.dispatchEvent(movedTool);
});

// Continue drawing stroke as mouse moves.
sketchCanvas.addEventListener("mousemove", (ev) => {
	if (isPanning) {
		panX = ev.clientX - startPanX;
		panY = ev.clientY - startPanY;
		sketchCanvas.dispatchEvent(movedTool); // Triggers redraw of both
		drawGrid(); // Make sure grid moves
		return;
	}
	
	const pageCoords = screenToPage(ev.offsetX, ev.offsetY, panX, panY, scale);
	// Bounds check for move
	const mapWidth = (tilesetInfo.WIDTH + 4) * tilesetInfo.TILE_WIDTH;
	const mapHeight = tilesetInfo.HEIGHT * tilesetInfo.TILE_WIDTH;
	const outsideBounds = pageCoords.x < 0 || pageCoords.x > mapWidth || pageCoords.y < 0 || pageCoords.y > mapHeight;


	// Update cursor
	mouseObject = new MouseDisplayable({
		x: ev.offsetX,
		y: ev.offsetY,
		hue: mouseObject.mouse.hue,
		active: mouseObject.mouse.active,
	}, conf.lineThickness);

	// Draw a stroke (if cursor is active)
	if (mouseObject.mouse.active && !outsideBounds) {
		if ({x: ev.offsetX, y:ev.offsetY}, sketchCanvas){ 
			// add new point to working line
			workingLine.points.push({
				x: pageCoords.x,
				y: pageCoords.y,
			});

			// add stroke to canvas
			sketchCanvas.dispatchEvent(changeDraw);

			// enable exports
			//exportButton.disabled = false;
		}
	}

	// redraw sketch canvas to capture new cursor position
	sketchCanvas.dispatchEvent(movedTool);
});

// Finish drawing stroke and optionally normalize.
sketchCanvas.addEventListener("mouseup", (ev) => {
	if (isPanning) {
		isPanning = false;
		sketchCanvas.style.cursor = "none";
		return;
	}
	
	// Update cursor
	mouseObject = new MouseDisplayable({
		x: ev.offsetX,
		y: ev.offsetY,
		hue: mouseObject.mouse.hue,
		active: false,
	}, conf.lineThickness);

	// Finish stroke (if it is long enough)
	if (workingLine && workingLine.points && workingLine.points.length <= conf.sizeThreshold) {
		displayList.pop();  // remove accidental tiny stroke
		undoStack.pop();	// also forget this canvas state
	} else {
		// normalize strokes (if normalize toggle is checked)
		let normalizeButton = document.getElementById("normalize-button")
		let normalizing = normalizeButton.classList.contains("active");
		if (normalizing) normalizeStrokes(displayList, sketchCanvas);

		// clear redo history
		redoStack = [];

		// redraw sketch canvas with new stroke + cursor position
		sketchCanvas.dispatchEvent(changeDraw);
		sketchCanvas.dispatchEvent(movedTool);
	}
});

// Hide cursor when it leaves canvas area
sketchCanvas.addEventListener("mouseleave", (e) => {
	mouseObject = new MouseDisplayable({
		x: -1,
		y: -1,
		hue: mouseObject.mouse.hue,
		active: false,
	}, 0);

	// redraw sketch canvas to capture new cursor position
	sketchCanvas.dispatchEvent(movedTool);
	drawGrid();
});

// Receives a region and checks whether there are already display lines there (?)
window.addEventListener("checkSketch", (e) => {
	let drawn = false

	for(let i = 0; i < displayList.length; i++) {
		const stroke = displayList[i]
		for (const point of stroke.line.points) {
			if (pointInRegion(point, e.detail.region)) {
				drawn = true
				break
			}
		}
	}

	// sends check result to Phaser scene
	const returnCheck = new CustomEvent("returnCheck", { 
		detail: {drawn: drawn} 
	});
	window.dispatchEvent(returnCheck);
})

// Receives region to be drawn from Phaser
window.addEventListener("mapToSketch", (e) => {
	// simulate a button press
	const button = document.getElementById(`${e.detail.type.toLowerCase()}-button`);
	button.click();

	undoStack.push(getSnapshot());

	const tl = e.detail.region.topLeft
	const br = e.detail.region.bottomRight
	const w = br.x - tl.x
	const rectPoints = [
		{ x: tl.x, y: tl.y },	// top-left
		{ x: tl.x, y: tl.y },	// top-left again to prevent culling
		{ x: br.x, y: tl.y },	// top-right
		{ x: br.x, y: br.y },	// bottom-right
		{ x: tl.x, y: br.y },	// bottom-left
		{ x: tl.x, y: tl.y }	// close
	];

	const rectLine = {
		points: rectPoints,
		thickness: conf.lineThickness,
		hue: mouseObject.mouse.hue,
		structure: e.detail.type,
	};
	
	const newDisplayable = new LineDisplayble(rectLine)
	newDisplayable.normalized = true	// assuming since it's a region imported from phaser, it's already a rect

	displayList.push(newDisplayable);

	redoDisplayList = [];
	redoStack = [];

	sketchCanvas.dispatchEvent(changeDraw);
	//exportButton.disabled = false;
})

//zoom event listener
const zoomAmountDisplay = document.getElementById(`zoom-indicator`);
sketchCanvas.addEventListener("wheel", (ev) => {
	ev.preventDefault();

	const zoomSpeed = 0.1;
	const oldScale = scale;

	//calcualtes the new scale
	if (ev.deltaY < 0) {
		scale += zoomSpeed;
	} else {
		scale = Math.max(0.1, scale - zoomSpeed);//so the scale can't go under 0
	}

	// update what the zoom percentage display looks like based on current scale
	zoomAmountDisplay.textContent = Math.round(scale * 100);

	//geting the mouse position in relation to the canvas
	const mouseX = ev.offsetX;
	const mouseY = ev.offsetY;

	//adjust the pointer to be with the mouse
	panX = mouseX - (mouseX - panX) * (scale / oldScale);
	panY = mouseY - (mouseY - panY) * (scale / oldScale);

	sketchCanvas.dispatchEvent(movedTool);
	drawGrid();
});

// Resets zoom and pan
const zoomResetButton = document.getElementById(`zoom-reset-button`);
zoomResetButton.onclick = () => {
	scale = 1.0;
	panX = 0;
	panY = 0;

	zoomAmountDisplay.textContent = 100;

	drawGrid();
}


// Clears canvas and structure display list.
const clearButton = document.getElementById(`clear-button`);
clearButton.onclick = () => {
	// push canvas snapshot to undo stack before clearing
	undoStack.push(getSnapshot());
	
	// clear display lists
	displayList = [];
	redoDisplayList = [];
	
	// clear canvas
	ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
	sketchCanvas.dispatchEvent(changeDraw);	// redraw sketch canvas 

	//exportButton.disabled = true;	

	// sends sketch data to Phaser scene
	const toPhaser = new CustomEvent("clearSketch", { 
		detail: {sketch: displayList, structures: conf.structures} 
	});
	window.dispatchEvent(toPhaser);
};

// Sends sketch data to Phaser via custom event.
const generateButton = document.getElementById("generate-button");
generateButton.onclick = () => {
	// label strokes with structure type
	// showDebugText(ctx, displayList);
	
	// sends sketch data to Phaser scene
	const toPhaser = new CustomEvent("generate", { 
		detail: {sketch: displayList, structures: conf.structures} 
	});
	window.dispatchEvent(toPhaser);
}

// Normalize strokes (straighten lines, find shapes, etc)
const normalizeToggle = document.getElementById("normalize-button");
normalizeToggle.onclick = () => {
	// update normalizing tracker bool to reflect toggle value
	//normalizing = document.getElementById("normalize-toggle").checked;
	let normalizing = normalizeToggle.classList.toggle("active")
	if (normalizing) {
		normalizeStrokes(displayList, sketchCanvas);
		sketchCanvas.dispatchEvent(changeDraw); // Re-render the canvas after simplifying
	}
}

// Undo last action and re-render canvas.
const undoButton = document.getElementById(`undo-button`);
undoButton.onclick = () => {
	if (undoStack.length === 0) return; // nothing to undo

	// perform undo and push undone data to redo stack
	redoStack.push(undo(undoStack.pop()));

	// update canvas to reflect undo
	sketchCanvas.dispatchEvent(changeDraw);

	// update Phaser
	const toPhaser = new CustomEvent("undoSketch", { 
		detail: {sketch: displayList, structures: conf.structures} 
	});
	window.dispatchEvent(toPhaser);
}

// Redo last undone action and re-render canvas.
const redoButton = document.getElementById(`redo-button`);
redoButton.onclick = () => {
	if (redoStack.length === 0) return; // nothing to redo

	// perform redo and push redone data to undo stack
	undoStack.push(redo(redoStack.pop()));

	// update canvas to reflect redo
	sketchCanvas.dispatchEvent(changeDraw);

	// update Phaser
	const toPhaser = new CustomEvent("redoSketch", { 
		detail: {sketch: displayList, structures: conf.structures} 
	});
	window.dispatchEvent(toPhaser);
}

// ERASING
function erase(region){
	undoStack.push(getSnapshot())

	for(let i = 0; i < displayList.length; i++) {
		const stroke = displayList[i]
		for (const point of stroke.line.points) {
			if (pointInRegion(point, region)) {
				displayList.splice(i, 1)
				break
			}
		}
	}

	redoStack = [];
	redoDisplayList = [];

	sketchCanvas.dispatchEvent(changeDraw);
}

function pointInRegion(point, region) {
	// TODO: sketchpad erasing

	// rectangular erase for phaser erase
	if (region.topLeft && region.bottomRight) {
		return (
			point.x >= region.topLeft.x &&
			point.x <= region.bottomRight.x &&
			point.y >= region.topLeft.y &&
			point.y <= region.bottomRight.y
		);
	}
	
	return false;
}

// phaser erase event
window.addEventListener("phaserErase", (e) => {
	erase({
		topLeft: e.detail.region.topLeft,
		bottomRight: e.detail.region.bottomRight
	});
});

/**
 * Keyboard shortcuts:
 * - Ctrl/Cmd + Z → Undo
 * - Ctrl/Cmd + Shift + Z → Redo
 */
document.addEventListener('keydown', (e) => {
	if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
		// Ctrl/Cmd + Shift + Z → Redo
		if (e.shiftKey) document.getElementById("redo-button").click();

		// Ctrl/Cmd + Z → Undo
		else document.getElementById("undo-button").click();
	}
});

/**
 * Returns current display list arrays.
 * @param {"display"|"redo"} [l] - Which list to return (displayList or redoDisplayList).
 * @returns {LineDisplayble[]}
 */
export function getDisplayList(l) {
	if (!l || l.toLowerCase() === "display") return displayList;
	else if (l.toLowerCase() === "redo") return redoDisplayList;
}

/**
 * Overwrites the display list arrays.
 * @param {LineDisplayble[]} data - New list of strokes.
 * @param {"undo"|"redo"} [key="undo"] - Which list to update.
 */
export function setDisplayList(data, key) {
	if (!key || key.toLowerCase() === "undo") displayList = data;
	else if (key.toLowerCase() === "redo") redoDisplayList = data;
}

// EXPORTS
/*
const exportButton = document.getElementById("export-sketch-button");
exportButton.disabled = true;

exportButton.addEventListener("click", async () => {
    const zip = JSZip();
	await exportSketch(zip)

	// generate zip
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "sketchtiler_export_sketch.zip");
});

// loads JSZip zip file with sketch data and sketch canvas snapshot
export async function exportSketch(zip){
    // add sketch data to the zip
    zip.file("sketchData.json", JSON.stringify({
      sketch: displayList,
    }));

    // add sketch image to the zip
    const canvas = document.getElementById("sketch-canvas");
    const dataURL = canvas.toDataURL("image/PNG")
    const base64Data = dataURL.replace(/^data:image\/(png|jpg);base64,/, "");

    zip.file("sketchImage.png", base64Data, { base64: true });
	
	exportButton.disabled = true;
}
*/
