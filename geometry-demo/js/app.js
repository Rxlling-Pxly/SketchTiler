import {
  polygonFromStroke,
  findConcaveVertices,
  boundingBoxVertices,
  computeLDecompositionRects
} from './geometry.js';

import { snapPolygonAxisAligned } from './snapping.js';
import { earClipTriangulate } from './triangulation.js';

import {
  classifyDonutFromStrokes,
  donutRectangles,
  donutCircles,
  donutTriangulation
} from './donut.js';

import { resizeCanvas, draw as drawScene } from './render.js';
import { setupUI } from './ui.js';

// ===================== Global State =====================

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const state = {
  mode: "l_rect",
  triMode: "wire", // "wire", "fill", "both"

  // snapping controls
  gridSize: 25,
  snapEnabled: true,

  // toggles
  showRaw: true,
  showSnap: true,
  showBoxes: true,
  showRects: true,
  showCircles: true,
  showConcave: true,

  drawing: false,
  currentStroke: [],
  strokes: [],

  // single-shape modes (L + general)
  rawPoly: null,
  snappedPoly: null,
  concaveFlags: [],
  bigBox: null,
  decompRects: [],
  triangles: [],
  triBoxes: [],

  // donut modes
  outerRaw: null,
  innerRaw: null,
  snappedOuter: null,
  snappedInner: null,
  donutRectOuter: null,
  donutRectInner: null,
  donutIsCircular: false,
  donutCircleOuter: null,
  donutCircleInner: null
};

function draw() {
  drawScene(canvas, ctx, state);
}

// ===================== Processing per Mode =====================

function resetComputed() {
  state.rawPoly = null;
  state.snappedPoly = null;
  state.concaveFlags = [];
  state.bigBox = null;
  state.decompRects = [];
  state.triangles = [];
  state.triBoxes = [];

  state.outerRaw = null;
  state.innerRaw = null;
  state.snappedOuter = null;
  state.snappedInner = null;
  state.donutRectOuter = null;
  state.donutRectInner = null;
  state.donutIsCircular = false;
  state.donutCircleOuter = null;
  state.donutCircleInner = null;
}

function recompute() {
  // Re-run processing for the current mode using existing strokes.
  if (state.mode === "donut_rect" || state.mode === "donut_tri") {
    if (state.strokes.length > 0) processDonutStrokes();
  } else {
    if (state.strokes.length > 0) processSingleStroke();
  }
}

function processSingleStroke() {
  resetComputed();
  const poly = polygonFromStroke(state.strokes[0]);
  if (!poly) return;

  state.rawPoly = poly;
  state.concaveFlags = findConcaveVertices(poly);
  const snapped = state.snapEnabled ? snapPolygonAxisAligned(poly, state.gridSize) : poly;
  state.snappedPoly = snapped;
  state.bigBox = boundingBoxVertices(snapped.vertices);

  if (state.mode === "l_rect") {
    state.decompRects = computeLDecompositionRects(snapped);
  } else if (state.mode === "l_tri") {
    const tris = earClipTriangulate(snapped);
    state.triangles = tris;
    state.triBoxes = tris.map(t => boundingBoxVertices([t.a, t.b, t.c]));
  } else if (state.mode === "general") {
    const tris = earClipTriangulate(snapped);
    state.triangles = tris;
    state.triBoxes = tris.map(t => boundingBoxVertices([t.a, t.b, t.c]));
  }
}

function processDonutStrokes() {
  resetComputed();
  const result = classifyDonutFromStrokes(state.strokes, {
    gridSize: state.gridSize,
    snapEnabled: state.snapEnabled
  });
  if (!result) return;

  if (result.mode === "outer-only") {
    state.outerRaw = result.outerRaw;
    state.snappedOuter = result.snappedOuter;
    // preview only; no donut overlays yet
    return;
  }

  // full donut
  state.outerRaw = result.outerRaw;
  state.innerRaw = result.innerRaw;
  state.snappedOuter = result.snappedOuter;
  state.snappedInner = result.snappedInner;

  const rects = donutRectangles(state.snappedOuter, state.snappedInner);
  state.donutRectOuter = rects.rectOuter;
  state.donutRectInner = rects.rectInner;

  const circ = donutCircles(state.outerRaw, state.innerRaw);
  state.donutIsCircular = circ.isCircular;
  state.donutCircleOuter = circ.circleOuter;
  state.donutCircleInner = circ.circleInner;

  if (state.mode === "donut_tri") {
    const triRes = donutTriangulation(state.snappedOuter, state.snappedInner);
    state.triangles = triRes.triangles;
    state.triBoxes = triRes.boxes;
  }
}

// ===================== Mouse Handling =====================

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  state.drawing = true;
  state.currentStroke = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }];
});

canvas.addEventListener("mousemove", (e) => {
  if (!state.drawing) return;
  const rect = canvas.getBoundingClientRect();
  state.currentStroke.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  draw();
});

canvas.addEventListener("mouseup", (e) => {
  if (!state.drawing) return;
  state.drawing = false;
  const rect = canvas.getBoundingClientRect();
  state.currentStroke.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });

  if (state.mode === "donut_rect" || state.mode === "donut_tri") {
    if (state.strokes.length < 2) {
      state.strokes.push(state.currentStroke.slice());
      state.currentStroke = [];
      processDonutStrokes();
    }
  } else {
    state.strokes = [state.currentStroke.slice()];
    state.currentStroke = [];
    processSingleStroke();
  }
  draw();
});

canvas.addEventListener("mouseleave", () => {
  state.drawing = false;
});

// ===================== Init =====================

window.addEventListener("resize", () => {
  resizeCanvas(canvas);
  draw();
});

resizeCanvas(canvas);

setupUI(state, {
  draw,
  resetComputed,
  recompute
});

draw();
