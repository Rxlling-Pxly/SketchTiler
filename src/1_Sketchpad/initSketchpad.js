/**
 * @fileoverview Initializes and sizes the sketchpad, grid canvas, and sketch canvas
 * based on the current TILEMAP configuration. Also renders a visual grid overlay.
 */
import TILEMAP from "../4_Phaser/TILEMAP.js";

const sketchpad = document.getElementById("sketchpad");
const gridCanvas = document.getElementById("grid-canvas");
const sketchCanvas = document.getElementById("sketch-canvas");

/**
 * Initializes the sketchpad dimensions and rendering settings.
 * Sets canvas sizes based on TILEMAP settings and draws a grid overlay.
 * 
 * @function initSketchpad
 */
export default function initSketchpad() {
  const width = TILEMAP.WIDTH * TILEMAP.TILE_WIDTH;
  const height = TILEMAP.HEIGHT * TILEMAP.TILE_WIDTH;
  
  sketchpad.style.width = `${width}px`;
  sketchpad.style.height = `${height}px`;
  
  gridCanvas.width = width;
  gridCanvas.height = height;
  drawGrid();
  
  sketchCanvas.width = width;
  sketchCanvas.height = height;
  sketchCanvas.getContext("2d").font = "30px serif";
}

/**
 * Draws a uniform grid on the gridCanvas.
 * Each grid cell is a square defined by `cellSize`.
 * 
 * @function drawGrid
 */
function drawGrid() {
  const cellSize = TILEMAP.TILE_WIDTH;
  const color = "#DBDBDB";

  const width = gridCanvas.width;
  const height = gridCanvas.height;
  const ctx = gridCanvas.getContext("2d");
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += cellSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += cellSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}