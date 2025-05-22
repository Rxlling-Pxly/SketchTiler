import { chaikinSmooth, ramerDouglasPeucker } from "./lineCleanup.js";
import { LineDisplayble, MouseDisplayable } from "./displayables.js";
import { getShape } from "./shapeDetection.js";

const sketchCanvas = document.getElementById("sketch-canvas");
const ctx = sketchCanvas.getContext("2d");

//* DRAWING *//
const normalizeToggle = document.getElementById("normalize-toggle");
let normalizing = normalizeToggle.checked;

const lineThickness = 5;
const sizeThreshold = 5;	// number of points that must be drawn for the stroke to be recorded
let workingLine = { points: [], thickness: lineThickness, hue: 0, structure: null };
let mouseObject = new MouseDisplayable({
	x: 0,
	y: 0,
	hue: 0,
	active: false,
}, lineThickness);

//* STATE TRACKING *//
// strokes
let displayList = []; 
let redoDisplayList = [];

// state snapshots
let undoStack = [];
let redoStack = [];

//* STRUCTURES *//
// NOTE: regions can be "box" or "trace",
//    this will be the region that structure generators use to place tiles.
const structures = {  
	"House" : { color: '#f54242', regionType: "box"   },
	"Forest": { color: '#009632', regionType: "box"   },
	"Fence" : { color: '#f5c842', regionType: "trace" },
	"Path"  : { color: '#8000ff', regionType: "trace" },
};

// STRUCTURE BUTTONS
let activeButton;
for (const type in structures) {
	const structure = structures[type];
	const button = document.getElementById(`${type.toLowerCase()}-button`);
	if(!button) continue;
	button.onclick = () => {
		mouseObject.mouse.hue = structure.color;
		button.style.borderColor = structure.color;  
		activeButton = type;
	}
}
// initial selected marker
document.getElementById("house-button").click();

//console.log(structureSketches); // DEBUG

//* SKETCH EVENTS *//
const clearPhaser = new CustomEvent("clearSketch");		// phaser event
const undoPhaser = new CustomEvent("undoSketch");		// phaser event
const redoPhaser = new CustomEvent("redoSketch");		// phaser event

// When changeDraw is dispatched, the drawing area will be repainted.
const changeDraw = new Event("drawing-changed"); 
sketchCanvas.addEventListener("drawing-changed", () => {
	ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
	for (const d of displayList) {
		d.display(ctx);
	}
});

// move tool/cursor around canvas
const movedTool = new Event("tool-moved");
sketchCanvas.addEventListener("tool-moved", () => {
	ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
	for (const d of displayList) {
		d.display(ctx);
	}
	mouseObject.display(ctx);
});

// mouse click event, start drawing
sketchCanvas.addEventListener("mousedown", (ev) => {
	mouseObject = new MouseDisplayable({
		x: ev.offsetX,
		y: ev.offsetY,
		hue: mouseObject.mouse.hue,
		active: true,
	}, lineThickness);
	if(inCanvasBounds({ x: mouseObject.mouse.x, y: mouseObject.mouse.y })){ 
		// action tracking: save current canvas state before adding a stroke
		undoStack.push({
			display: [...displayList],
			redo: [...redoDisplayList]
		});

		// init workingLine with new points
		workingLine = {
			points: [{ x: mouseObject.mouse.x, y: mouseObject.mouse.y }],
			thickness: lineThickness,
			hue: mouseObject.mouse.hue,
			structure: activeButton
		};
		displayList.push(new LineDisplayble(workingLine)); 

		// clear redo strokes
		redoDisplayList = [];

		sketchCanvas.dispatchEvent(changeDraw);
		sketchCanvas.dispatchEvent(movedTool);
	}
});

// mouse move event, draw on canvas
sketchCanvas.addEventListener("mousemove", (ev) => {
	mouseObject = new MouseDisplayable({
		x: ev.offsetX,
		y: ev.offsetY,
		hue: mouseObject.mouse.hue,
		active: mouseObject.mouse.active,
	}, lineThickness);
	if (mouseObject?.mouse.active) {
		if(inCanvasBounds({ x: mouseObject.mouse.x, y: mouseObject.mouse.y })){ 
			// add new point to working line
			workingLine.points.push({
				x: mouseObject.mouse.x,
				y: mouseObject.mouse.y,
			});

			sketchCanvas.dispatchEvent(changeDraw);
		}
	}
	sketchCanvas.dispatchEvent(movedTool);
});

// mouse up event, stop drawing
sketchCanvas.addEventListener("mouseup", (ev) => {
	mouseObject = new MouseDisplayable({
		x: ev.offsetX,
		y: ev.offsetY,
		hue: mouseObject.mouse.hue,
		active: false,
	}, lineThickness);

	if(workingLine.points.length <= sizeThreshold){
		displayList.pop();  // remove accidental tiny stroke
		undoStack.pop();	// also forget this canvas state
	} else {
		// check if "Normalize shapes" is checked
		normalizing = document.getElementById("normalize-toggle").checked;
		if(normalizing) normalizeStrokes();

		redoStack = [];

		sketchCanvas.dispatchEvent(changeDraw);
		sketchCanvas.dispatchEvent(movedTool);
	}
});

//*** FUNCTION BUTTONS ***/
//* CLEAR *//
// updates phaser scene, clearing structures
const clearButton = document.getElementById(`clear-button`);
clearButton.onclick = () => {
	// push a clear action to undo stack
	undoStack.push({
		display: [...displayList],
		redo: [...redoDisplayList]
	});

	// clear canvas
	clear();
};

// handles canvas clearing
function clear() {
	ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
	displayList = [];
	redoDisplayList = [];
	window.dispatchEvent(clearPhaser);
	sketchCanvas.dispatchEvent(changeDraw);
}

//* GENERATE */
const generateButton = document.getElementById("generate-button");
generateButton.onclick = () => {
	showDebugText();
	
	// sends sketch data to Phaser scene
	const toPhaser = new CustomEvent("generate", { 
		detail: {sketch: displayList, structures: structures} 
	});
	window.dispatchEvent(toPhaser);
}

//* NORMALIZE STROKES *//
normalizeToggle.onclick = () => {
	normalizing = document.getElementById("normalize-toggle").checked;
	if(normalizing){ normalizeStrokes(); }
}
function normalizeStrokes(){
	// shape-ify each line in displayList
	for (const displayable of displayList) {
		if (displayable instanceof LineDisplayble) {
			if(!displayable.normalized){	// don't re-normalize a stroke that has already been normalized
				displayable.normalized = true;
				const shape = getShape(displayable.line.points);
				//console.log(displayable, shape)
				if(shape){
					displayable.line.points = shape.points;
				} else {
					// for unrecognized shapes, de-noise stroke by running rdp, then chaikin
					const simplified = ramerDouglasPeucker(displayable.line.points, 10); // Adjust tolerance as needed
					const smoothed = chaikinSmooth(simplified, 4);
					displayable.line.points = smoothed.filter(p => inCanvasBounds(p));
				}
			}
		}
	}
	sketchCanvas.dispatchEvent(changeDraw); // Re-render the canvas after simplifying
}

//*** HISTORY ***/
//* UNDO *//
const undoButton = document.getElementById(`undo-button`);
undoButton.onclick = undo;
function undo(){
	//console.log("UNDO STACK", undoStack);
	//console.log("REDO STACK", redoStack);

	if(undoStack.length === 0){ return; }

	let lastAction = undoStack.pop();

	redoStack.push({
		display: [...displayList],
		redo: [...redoDisplayList]
	});

	displayList = [...lastAction.display];
	redoDisplayList = [...lastAction.redo];
	sketchCanvas.dispatchEvent(changeDraw);
	window.dispatchEvent(undoPhaser);	// notify phaser
	return;
}

//* REDO *//
const redoButton = document.getElementById(`redo-button`);
redoButton.onclick = redo;
function redo() {
	if(redoStack.length === 0){ return; }

	let action = redoStack.pop();

	undoStack.push({
		display: [...displayList],
		redo: [...redoDisplayList]
	})

	displayList = [...action.display];
	redoDisplayList = [...action.redo];
	sketchCanvas.dispatchEvent(changeDraw);
	window.dispatchEvent(redoPhaser);	// notify phaser
	return;
}

// handle undo/redo for draw actions
function updateDrawHistory(fromHistory, toHistory){
	const stroke = fromHistory.pop();
	if(stroke != undefined) {
		toHistory.push(stroke);
		sketchCanvas.dispatchEvent(changeDraw);
	} 
	else {
		return false;	// history handling failure
	}

	return true;		// history handling success
}

//*** UTILS ***/
// KEYBOARD SHORTCUTS
document.addEventListener('keydown', (e) => {
	if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z"){
		if(e.shiftKey){ redo(); }
		else { undo(); }
	}
});

function inCanvasBounds(p) {
	return p.x >= 0 && p.x <= sketchCanvas.width-1 && p.y >= 0 && p.y <= sketchCanvas.height-1;
}

// DEBUG: labels strokes' structure types
function showDebugText(){
	//console.log(displayList);
	ctx.fillStyle = "black";      
	for(let d of displayList){
		let line = d.line;
		ctx.fillText(line.structure, line.points[0].x, line.points[0].y)
	}
}

//---------- LEGACY CODE ----------//
/*
// export canvas as png
const exportButton = document.createElement("button");
exportButton.innerHTML = "Export Drawing";
buttonContainer.append(exportButton);
exportButton.onclick = () => {
	const exportCanvas = document.createElement("canvas");
	const exportContext = exportCanvas.getContext("2d");
	exportCanvas.width = 1920;
	exportCanvas.height = 1080;
	exportContext.scale(1.5, 1.5);

	for (const d of displayList) {
		d.display(exportContext);
	}

	const imageData = exportCanvas.toDataURL("image/png");

	const downloadLink = document.createElement("a");
	downloadLink.href = imageData;
	downloadLink.download = `${APP_NAME}.png`;
	downloadLink.click();
};
*/

/*
// straighten lines
const straightenLinesButton = document.getElementById("straighten-lines-button");
straightenLinesButton.onclick = () => {
	// Simplify each line in displayList
	for (const displayable of displayList) {
		if (displayable instanceof LineDisplayble) {
			const simplifiedPoints = ramerDouglasPeucker(displayable.line.points, 10); // Adjust tolerance as needed
			displayable.line.points = simplifiedPoints;
		}
	}
	sketchCanvas.dispatchEvent(changeDraw); // Re-render the canvas after simplifying
}
*/