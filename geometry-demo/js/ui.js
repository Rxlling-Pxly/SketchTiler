// ===================== UI Wiring =====================

function updateHint(state, hintText) {
  switch (state.mode) {
    case "l_rect":
      hintText.textContent = "L-Shape Rectangular: draw a rough L-shape as one closed stroke.";
      break;
    case "l_tri":
      hintText.textContent = "L-Shape Triangulation: draw a rough L-shape as one closed stroke.";
      break;
    case "donut_rect":
      hintText.textContent = "Donut Rectangular: draw outer loop, then inner loop (hole).";
      break;
    case "donut_tri":
      hintText.textContent = "Donut Triangulation: draw outer loop, then inner loop (hole).";
      break;
    case "general":
      hintText.textContent = "General Polygon: draw any simple closed shape as one stroke.";
      break;
  }
}

function updateTriModeButtonLabel(state, triModeBtn) {
  if (state.triMode === "wire") triModeBtn.textContent = "Triangles: Wireframe";
  else if (state.triMode === "fill") triModeBtn.textContent = "Triangles: Filled";
  else triModeBtn.textContent = "Triangles: Wire+Fill";
}

function cycleTriMode(state) {
  if (state.triMode === "wire") state.triMode = "fill";
  else if (state.triMode === "fill") state.triMode = "both";
  else state.triMode = "wire";
}

function resetForModeChange(state, resetComputed) {
  // reset strokes & computed state
  state.strokes = [];
  state.currentStroke = [];
  resetComputed();
}

export function setupUI(state, { draw, resetComputed, recompute }) {
  const modeSelect = document.getElementById("modeSelect");
  const clearBtn = document.getElementById("clearBtn");
  const gridSizeSlider = document.getElementById("gridSize");
  const gridSizeVal = document.getElementById("gridSizeVal");
  const snapEnabledCb = document.getElementById("snapEnabled");
  const showRawCb = document.getElementById("showRaw");
  const showSnapCb = document.getElementById("showSnap");
  const showBoxesCb = document.getElementById("showBoxes");
  const showRectsCb = document.getElementById("showRects");
  const showCirclesCb = document.getElementById("showCircles");
  const showConcaveCb = document.getElementById("showConcave");
  const triModeBtn = document.getElementById("triModeBtn");
  const hintText = document.getElementById("hintText");

  modeSelect.addEventListener("change", () => {
    state.mode = modeSelect.value;
    resetForModeChange(state, resetComputed);
    updateHint(state, hintText);
    draw();
  });

  clearBtn.addEventListener("click", () => {
    state.strokes = [];
    state.currentStroke = [];
    resetComputed();
    draw();
  });

  // Snapping controls
  // defaults (in case state was created without these fields)
  if (typeof state.gridSize !== "number") state.gridSize = Number(gridSizeSlider.value);
  if (typeof state.snapEnabled !== "boolean") state.snapEnabled = snapEnabledCb.checked;

  gridSizeSlider.value = String(state.gridSize);
  gridSizeVal.textContent = String(state.gridSize);
  snapEnabledCb.checked = state.snapEnabled;

  gridSizeSlider.addEventListener("input", () => {
    state.gridSize = Number(gridSizeSlider.value);
    gridSizeVal.textContent = String(state.gridSize);
    resetComputed();
    if (typeof recompute === "function") recompute();
    draw();
  });

  snapEnabledCb.addEventListener("change", () => {
    state.snapEnabled = snapEnabledCb.checked;
    resetComputed();
    if (typeof recompute === "function") recompute();
    draw();
  });

  showRawCb.addEventListener("change", () => {
    state.showRaw = showRawCb.checked;
    draw();
  });
  showSnapCb.addEventListener("change", () => {
    state.showSnap = showSnapCb.checked;
    draw();
  });
  showBoxesCb.addEventListener("change", () => {
    state.showBoxes = showBoxesCb.checked;
    draw();
  });
  showRectsCb.addEventListener("change", () => {
    state.showRects = showRectsCb.checked;
    draw();
  });
  showCirclesCb.addEventListener("change", () => {
    state.showCircles = showCirclesCb.checked;
    draw();
  });
  showConcaveCb.addEventListener("change", () => {
    state.showConcave = showConcaveCb.checked;
    draw();
  });

  triModeBtn.addEventListener("click", () => {
    cycleTriMode(state);
    updateTriModeButtonLabel(state, triModeBtn);
    draw();
  });

  // init
  updateHint(state, hintText);
  updateTriModeButtonLabel(state, triModeBtn);
  draw();
}
