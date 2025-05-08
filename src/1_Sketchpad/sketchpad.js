import { chaikinSmooth, ramerDouglasPeucker } from "./lineCleanup.js";
import { LineDisplayble, MouseDisplayable } from "./Displayables.js";
import { getShape } from "./shapeDetection.js";

const sketchCanvas = document.getElementById("sketch-canvas");
const ctx = sketchCanvas.getContext("2d");

//* DRAWING *//
const normalizeToggle = document.getElementById("normalize-toggle");
let normalizing = normalizeToggle.checked;

const lineThickness = 5;
let workingLine = { points: [], thickness: lineThickness, hue: 0, structure: null };
let mouseObject = new MouseDisplayable({
	x: 0,
	y: 0,
	hue: 0,
	active: false,
}, lineThickness);

let displayList = []; 
let redoDisplayList = [];

// define structures
// NOTE: regions can be "box" or "trace",
//    this will be the region that structure generators use to place tiles.
const structures = [  
	{type: "House" , color: '#f54242', region: "box"   },
	{type: "Forest", color: '#009632', region: "box"   },
	{type: "Fence" , color: '#f5c842', region: "trace" },
	{type: "Path"  , color: '#8000ff', region: "trace" },
];
let structureSketches = { lastIndex: -1 }
structures.forEach((s) => {
	structureSketches[s.type] = {
		info: s,
		strokes: []
	}
});
console.log(structureSketches); // DEBUG

//* EVENTS *//
// sends sketch data to Phaser scene
const toPhaser = new CustomEvent("generate", { detail: structureSketches });

// updates phaser scene, clearing structures
const clearPhaser = new CustomEvent("clearSketch");

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
	workingLine = {
		points: [{ x: mouseObject.mouse.x, y: mouseObject.mouse.y }],
		thickness: lineThickness,
		hue: mouseObject.mouse.hue,
		structure: workingLine.structure
	};
	displayList.push(new LineDisplayble(workingLine));
	sketchCanvas.dispatchEvent(changeDraw);
	sketchCanvas.dispatchEvent(movedTool);
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
			workingLine.points.push({
				x: mouseObject.mouse.x,
				y: mouseObject.mouse.y,
			});
			sketchCanvas.dispatchEvent(changeDraw);
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

	// check if "Normalize shapes" is checked
	normalizing = document.getElementById("normalize-toggle").checked;
	if(normalizing) normalizeStrokes();

	updateStructureSketchHistory();
	sketchCanvas.dispatchEvent(changeDraw);
	sketchCanvas.dispatchEvent(movedTool);
});

//* BUTTONS *//

// clear drawing
const clearButton = document.getElementById(`clear-button`);
clearButton.onclick = () => {
	ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
	displayList = [];
	redoDisplayList = [];
	clearStructureSketchHistory();
	window.dispatchEvent(clearPhaser);
};

/*
// undo last stroke
const undoButton = document.createElement("button");
undoButton.innerHTML = "Undo";
buttonContainer.append(undoButton);
undoButton.onclick = () => {
	// TODO: optimize?
	//    would be better to just remove the stroke in question but this works for now
	clearStructureSketchHistory();      
	const toRedo = displayList.pop();
	if (toRedo != undefined) {
		redoDisplayList.push(toRedo);
	}
	sketchCanvas.dispatchEvent(changeDraw);
};

// redo last stroke
const redoButton = document.createElement("button");
redoButton.innerHTML = "Redo";
buttonContainer.append(redoButton);
redoButton.onclick = () => {
	// TODO: optimize?
	//    would be better to just remove the stroke in question but this works for now
	clearStructureSketchHistory();
	const toDisplay = redoDisplayList.pop();
	if (toDisplay != undefined) {
		displayList.push(toDisplay);
	}

	sketchCanvas.dispatchEvent(changeDraw);
};

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

// assign structure buttons
for (const structure of structures) {
	const button = document.getElementById(`${structure.type.toLowerCase()}-button`);
	button.onclick = () => {
		mouseObject.mouse.hue = structure.color;
		button.style.borderColor = structure.color;  // TODO: only highlight active button
		workingLine.structure = structure.type;
	}
}
// initial selected marker
document.getElementById("house-button").click();

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

// generate button
const generateButton = document.getElementById("generate-button");
generateButton.onclick = () => {
	showDebugText();
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
				console.log(displayable, shape)
				if(shape){
					displayable.line.points = shape.points;
				} else {
					// for unrecognized shapes, de-noise stroke by running rdp, then chaikin
					const simplified = ramerDouglasPeucker(displayable.line.points, 10); // Adjust tolerance as needed
					const smoothed = chaikinSmooth(simplified, 4);
					displayable.line.points = smoothed;
				}
			}
		}
	}
	sketchCanvas.dispatchEvent(changeDraw); // Re-render the canvas after simplifying
}

//* STRUCTURES ORGANIZATION *//
// organize displayList by structure,
function updateStructureSketchHistory(){
	// only add new strokes (added since last generation call)
	for(let i = structureSketches.lastIndex + 1; i < displayList.length; i++){
		let stroke = displayList[i].line;
			// ignore invis "strokes" and non-structure strokes
		if(stroke.points.length > 1 && stroke.structure){ 
			structureSketches[stroke.structure].strokes.push(stroke.points);
		}
	}

	structureSketches.lastIndex = displayList.length - 1;
}

// clears drawn points from structure history
function clearStructureSketchHistory(){
	for(let s in structureSketches){
		if(structureSketches[s].strokes){ 
			structureSketches[s].strokes = []; 
		}
	}
	structureSketches.lastIndex = -1;

}

// DEBUG: labels strokes' structure types
function showDebugText(){
	updateStructureSketchHistory();
	for(let s in structureSketches){
		if(structureSketches[s].strokes){
			structureSketches[s].strokes.forEach((ln) => {
				ctx.fillStyle = "black";      
				ctx.fillText(s, ln[0].x, ln[0].y)
			})
		}
	}
}


  