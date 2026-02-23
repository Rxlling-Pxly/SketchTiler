/**
 * @fileoverview
 * Sketch canvas input handler for a shape-drawing system.
 * Supports drawing, undo/redo history, stroke normalization, and communication with a Phaser scene.
 */

import { LineDisplayble, MouseDisplayable } from "./1_Classes/displayables.js";
import { WorkingLine } from "./1_Classes/line.js";
import { conf } from "./2_Utils/canvasConfig.js";
import { normalizeStrokes, screenToPage } from "./2_Utils/canvasUtils.js";
import { undo, redo, getSnapshot } from "./2_Utils/canvasHistory.js";
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
let mouseObject = new MouseDisplayable(
  {
    x: 0,
    y: 0,
    hue: 0,
    active: false,
  },
  conf.lineThickness
);

let displayList = []; // Displayed strokes currently on canvas.
let redoDisplayList = []; // Strokes removed via undo, recorded for redo support

let undoStack = []; // Snapshots of canvas state for undo operations
let redoStack = []; // Snapshots of canvas state for redo operations

let activeButton;
let currentActiveButton;

// Zoom and pan state
let scale = 1.0;
let panX = 0;
let panY = 0;

// Panning state
let isPanning = false;
let startPanY = 0;
let startPanX = 0;
let spacePressed = false;

export function drawGrid() {
  gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
  gridCtx.save();
  gridCtx.translate(panX, panY);
  gridCtx.scale(scale, scale);

  gridCtx.strokeStyle = "#DBDBDB";
  gridCtx.lineWidth = 1;

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

for (const type in conf.structures) {
  const structure = conf.structures[type];
  const button = document.getElementById(`${type.toLowerCase()}-button`);
  if (!button) continue;

  button.onclick = () => {
    mouseObject.mouse.hue = structure.color;
    button.style.borderColor = structure.color;
    activeButton = type;

    if (currentActiveButton && currentActiveButton !== button) {
      currentActiveButton.classList.remove("active");
    }
    button.classList.add("active");
    currentActiveButton = button;
  };
}

document.getElementById("house-button").click();
sketchCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

const changeDraw = new Event("drawing-changed");
sketchCanvas.addEventListener("drawing-changed", () => {
  ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(scale, scale);

  for (const d of displayList) d.display(ctx);

  ctx.restore();
});

const movedTool = new Event("tool-moved");
sketchCanvas.addEventListener("tool-moved", () => {
  ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(scale, scale);

  for (const d of displayList) d.display(ctx);

  ctx.restore();
  mouseObject.display(ctx);
});

sketchCanvas.addEventListener("mousedown", (ev) => {
  if (ev.button === 2 || spacePressed) {
    isPanning = true;
    startPanX = ev.clientX - panX;
    startPanY = ev.clientY - panY;
    sketchCanvas.style.cursor = "grabbing";

    mouseObject = new MouseDisplayable(
      {
        x: -1,
        y: -1,
        hue: mouseObject.mouse.hue,
        active: false,
      },
      0
    );

    return;
  }

  const pageCoords = screenToPage(ev.offsetX, ev.offsetY, panX, panY, scale);

  const mapWidth = (tilesetInfo.WIDTH + 4) * tilesetInfo.TILE_WIDTH;
  const mapHeight = tilesetInfo.HEIGHT * tilesetInfo.TILE_WIDTH;

  if (
    pageCoords.x < 0 ||
    pageCoords.x > mapWidth ||
    pageCoords.y < 0 ||
    pageCoords.y > mapHeight
  ) {
    return;
  }

  mouseObject = new MouseDisplayable(
    {
      x: ev.offsetX,
      y: ev.offsetY,
      hue: mouseObject.mouse.hue,
      active: true,
    },
    conf.lineThickness
  );

  undoStack.push(getSnapshot());

  workingLine = {
    points: [pageCoords],
    thickness: conf.lineThickness,
    hue: mouseObject.mouse.hue,
    structure: activeButton,
  };

  displayList.push(new LineDisplayble(workingLine));
  redoDisplayList = [];

  sketchCanvas.dispatchEvent(changeDraw);
  sketchCanvas.dispatchEvent(movedTool);
});

sketchCanvas.addEventListener("mousemove", (ev) => {
  if (isPanning) {
    panX = ev.clientX - startPanX;
    panY = ev.clientY - startPanY;
    sketchCanvas.dispatchEvent(movedTool);
    drawGrid();
    return;
  }

  const pageCoords = screenToPage(ev.offsetX, ev.offsetY, panX, panY, scale);

  const mapWidth = (tilesetInfo.WIDTH + 4) * tilesetInfo.TILE_WIDTH;
  const mapHeight = tilesetInfo.HEIGHT * tilesetInfo.TILE_WIDTH;
  const outsideBounds =
    pageCoords.x < 0 ||
    pageCoords.x > mapWidth ||
    pageCoords.y < 0 ||
    pageCoords.y > mapHeight;

  mouseObject = new MouseDisplayable(
    {
      x: ev.offsetX,
      y: ev.offsetY,
      hue: mouseObject.mouse.hue,
      active: mouseObject.mouse.active,
    },
    conf.lineThickness
  );

  if (mouseObject.mouse.active && !outsideBounds) {
    workingLine.points.push({
      x: pageCoords.x,
      y: pageCoords.y,
    });

    sketchCanvas.dispatchEvent(changeDraw);
  }

  sketchCanvas.dispatchEvent(movedTool);
});

sketchCanvas.addEventListener("mouseup", (ev) => {
  if (isPanning) {
    isPanning = false;
    sketchCanvas.style.cursor = spacePressed ? "grab" : "none";
    return;
  }

  mouseObject = new MouseDisplayable(
    {
      x: ev.offsetX,
      y: ev.offsetY,
      hue: mouseObject.mouse.hue,
      active: false,
    },
    conf.lineThickness
  );

  if (workingLine && workingLine.points && workingLine.points.length <= conf.sizeThreshold) {
    displayList.pop();
    undoStack.pop();
  } else {
    const normalizeButton = document.getElementById("normalize-button");
    const normalizing = normalizeButton.classList.contains("active");
    if (normalizing) normalizeStrokes(displayList, sketchCanvas);

    redoStack = [];

    sketchCanvas.dispatchEvent(changeDraw);
    sketchCanvas.dispatchEvent(movedTool);
  }
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.repeat) {
    spacePressed = true;
    sketchCanvas.style.cursor = "grab";
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    spacePressed = false;
    isPanning = false;
    sketchCanvas.style.cursor = "none";
  }
});

sketchCanvas.addEventListener("mouseleave", () => {
  mouseObject = new MouseDisplayable(
    {
      x: -1,
      y: -1,
      hue: mouseObject.mouse.hue,
      active: false,
    },
    0
  );

  sketchCanvas.dispatchEvent(movedTool);
  drawGrid();
});

window.addEventListener("checkSketch", (e) => {
  let drawn = false;

  for (let i = 0; i < displayList.length; i++) {
    const stroke = displayList[i];
    for (const point of stroke.line.points) {
      if (pointInRegion(point, e.detail.region)) {
        drawn = true;
        break;
      }
    }
    if (drawn) break;
  }

  const returnCheck = new CustomEvent("returnCheck", {
    detail: { drawn: drawn },
  });
  window.dispatchEvent(returnCheck);
});

window.addEventListener("mapToSketch", (e) => {
  const button = document.getElementById(`${e.detail.type.toLowerCase()}-button`);
  if (button) button.click();

  undoStack.push(getSnapshot());

  const tl = e.detail.region.topLeft;
  const br = e.detail.region.bottomRight;
  const rectPoints = [
    { x: tl.x, y: tl.y },
    { x: tl.x, y: tl.y },
    { x: br.x, y: tl.y },
    { x: br.x, y: br.y },
    { x: tl.x, y: br.y },
    { x: tl.x, y: tl.y },
  ];

  const rectLine = {
    points: rectPoints,
    thickness: conf.lineThickness,
    hue: mouseObject.mouse.hue,
    structure: e.detail.type,
  };

  const newDisplayable = new LineDisplayble(rectLine);
  newDisplayable.normalized = true;

  displayList.push(newDisplayable);

  redoDisplayList = [];
  redoStack = [];

  sketchCanvas.dispatchEvent(changeDraw);
});

const zoomAmountDisplay = document.getElementById("zoom-indicator");
sketchCanvas.addEventListener("wheel", (ev) => {
  ev.preventDefault();

  const zoomSpeed = 0.1;
  const oldScale = scale;

  if (ev.deltaY < 0) {
    scale += zoomSpeed;
  } else {
    scale = Math.max(0.1, scale - zoomSpeed);
  }

  zoomAmountDisplay.textContent = Math.round(scale * 100);

  const mouseX = ev.offsetX;
  const mouseY = ev.offsetY;

  panX = mouseX - (mouseX - panX) * (scale / oldScale);
  panY = mouseY - (mouseY - panY) * (scale / oldScale);

  sketchCanvas.dispatchEvent(movedTool);
  drawGrid();
});

const zoomResetButton = document.getElementById("zoom-reset-button");
zoomResetButton.onclick = () => {
  scale = 1.0;
  panX = 0;
  panY = 0;

  zoomAmountDisplay.textContent = 100;

  drawGrid();
};

const clearButton = document.getElementById("clear-button");
clearButton.onclick = () => {
  undoStack.push(getSnapshot());

  displayList = [];
  redoDisplayList = [];

  ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
  sketchCanvas.dispatchEvent(changeDraw);

  const toPhaser = new CustomEvent("clearSketch", {
    detail: { sketch: displayList, structures: conf.structures },
  });
  window.dispatchEvent(toPhaser);
};

const generateButton = document.getElementById("generate-button");
generateButton.onclick = () => {
  const toPhaser = new CustomEvent("generate", {
    detail: { sketch: displayList, structures: conf.structures },
  });
  window.dispatchEvent(toPhaser);
};

const normalizeToggle = document.getElementById("normalize-button");
normalizeToggle.onclick = () => {
  const normalizing = normalizeToggle.classList.toggle("active");
  if (normalizing) {
    normalizeStrokes(displayList, sketchCanvas);
    sketchCanvas.dispatchEvent(changeDraw);
  }
};

const undoButton = document.getElementById("undo-button");
undoButton.onclick = () => {
  if (undoStack.length === 0) return;

  redoStack.push(undo(undoStack.pop()));

  sketchCanvas.dispatchEvent(changeDraw);

  const toPhaser = new CustomEvent("undoSketch", {
    detail: { sketch: displayList, structures: conf.structures },
  });
  window.dispatchEvent(toPhaser);
};

const redoButton = document.getElementById("redo-button");
redoButton.onclick = () => {
  if (redoStack.length === 0) return;

  undoStack.push(redo(redoStack.pop()));

  sketchCanvas.dispatchEvent(changeDraw);

  const toPhaser = new CustomEvent("redoSketch", {
    detail: { sketch: displayList, structures: conf.structures },
  });
  window.dispatchEvent(toPhaser);
};

function erase(region) {
  undoStack.push(getSnapshot());

  for (let i = 0; i < displayList.length; i++) {
    const stroke = displayList[i];
    for (const point of stroke.line.points) {
      if (pointInRegion(point, region)) {
        displayList.splice(i, 1);
        break;
      }
    }
  }

  redoStack = [];
  redoDisplayList = [];

  sketchCanvas.dispatchEvent(changeDraw);
}

function pointInRegion(point, region) {
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

window.addEventListener("phaserErase", (e) => {
  erase({
    topLeft: e.detail.region.topLeft,
    bottomRight: e.detail.region.bottomRight,
  });
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    if (e.shiftKey) document.getElementById("redo-button").click();
    else document.getElementById("undo-button").click();
  }
});

export function getDisplayList(l) {
  if (!l || l.toLowerCase() === "display") return displayList;
  if (l.toLowerCase() === "redo") return redoDisplayList;
}

export function setDisplayList(data, key) {
  if (!key || key.toLowerCase() === "undo") displayList = data;
  else if (key.toLowerCase() === "redo") redoDisplayList = data;
}
