// ===================== Canvas & Resize =====================

function resizeCanvas(canvas) {
  canvas.width = window.innerWidth - 260; // sidebar width
  canvas.height = window.innerHeight;
}

// ===================== Drawing Helpers =====================

function drawGrid(ctx, canvas) {
  const w = canvas.width, h = canvas.height, step = 25;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x += step) {
    ctx.moveTo(x, 0); ctx.lineTo(x, h);
  }
  for (let y = 0; y < h; y += step) {
    ctx.moveTo(0, y); ctx.lineTo(w, y);
  }
  ctx.stroke();
}

function drawStroke(ctx, state) {
  const { strokes, currentStroke } = state;
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const s of strokes) {
    if (s.length < 2) continue;
    ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
  }
  if (currentStroke.length > 1) {
    ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
    for (let i = 1; i < currentStroke.length; i++) ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
  }
  ctx.stroke();
}

function drawPolygonOutline(ctx, vertices, color, width) {
  if (!vertices || vertices.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(vertices[0].x, vertices[0].y);
  for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
  ctx.stroke();
}

function drawBox(ctx, box, strokeColor, lineWidth) {
  if (!box) return;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(
    box.minX,
    box.minY,
    box.maxX - box.minX,
    box.maxY - box.minY
  );
}

function drawFilledRectBox(ctx, box, fillColor, strokeColor, lineWidth) {
  if (!box) return;
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.fillRect(
    box.minX,
    box.minY,
    box.maxX - box.minX,
    box.maxY - box.minY
  );
  ctx.strokeRect(
    box.minX,
    box.minY,
    box.maxX - box.minX,
    box.maxY - box.minY
  );
}

// random pastel color
function pastelColor() {
  const r = 200 + Math.floor(Math.random() * 55);
  const g = 200 + Math.floor(Math.random() * 55);
  const b = 200 + Math.floor(Math.random() * 55);
  return `rgba(${r},${g},${b},0.8)`;
}

// ===================== Main Draw =====================

function draw(canvas, ctx, state) {
  drawGrid(ctx, canvas);
  drawStroke(ctx, state);

  const s = state;

  // Raw polygons
  if (s.showRaw) {
    if (s.mode === "donut_rect" || s.mode === "donut_tri") {
      if (s.outerRaw) drawPolygonOutline(ctx, s.outerRaw.vertices, "black", 1.5);
      if (s.innerRaw) drawPolygonOutline(ctx, s.innerRaw.vertices, "black", 1.5);
    } else {
      if (s.rawPoly) drawPolygonOutline(ctx, s.rawPoly.vertices, "black", 1.5);
    }
  }

  // Snapped polygons
  if (s.showSnap) {
    if (s.mode === "donut_rect" || s.mode === "donut_tri") {
      if (s.snappedOuter) drawPolygonOutline(ctx, s.snappedOuter.vertices, "blue", 3);
      if (s.snappedInner) drawPolygonOutline(ctx, s.snappedInner.vertices, "blue", 3);
    } else {
      if (s.snappedPoly) drawPolygonOutline(ctx, s.snappedPoly.vertices, "blue", 3);
    }
  }

  // Concave markers (L modes)
  if (s.showConcave && (s.mode === "l_rect" || s.mode === "l_tri")) {
    if (s.rawPoly && s.concaveFlags && s.concaveFlags.length > 0) {
      const v = s.rawPoly.vertices;
      ctx.fillStyle = "red";
      for (let i = 0; i < v.length; i++) {
        if (!s.concaveFlags[i]) continue;
        ctx.beginPath();
        ctx.arc(v[i].x, v[i].y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Big bounding box for L rect (optional) – not strictly needed, but we kept from original
  if (s.showBoxes && s.bigBox && (s.mode === "l_rect" || s.mode === "l_tri")) {
    drawBox(ctx, s.bigBox, "green", 2);
  }

  // Decomposition rectangles (L-Rect mode)
  if (s.showRects && s.mode === "l_rect" && s.decompRects && s.decompRects.length > 0) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.lineWidth = 2;
    for (const r of s.decompRects) {
      ctx.fillRect(r.minX, r.minY, r.maxX - r.minX, r.maxY - r.minY);
      ctx.strokeRect(r.minX, r.minY, r.maxX - r.minX, r.maxY - r.minY);
    }
  }

  // Triangles (L-Tri, Donut-Tri, General)
  if (s.triangles && s.triangles.length > 0) {
    for (const tri of s.triangles) {
      const { a, b, c } = tri;
      if (s.triMode === "fill" || s.triMode === "both") {
        ctx.fillStyle = pastelColor();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.closePath();
        ctx.fill();
      }
      if (s.triMode === "wire" || s.triMode === "both") {
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  // Triangle boxes
  if (s.showBoxes && s.triBoxes && s.triBoxes.length > 0) {
    ctx.strokeStyle = "green";
    ctx.lineWidth = 1.5;
    for (const b of s.triBoxes) {
      ctx.strokeRect(
        b.minX,
        b.minY,
        b.maxX - b.minX,
        b.maxY - b.minY
      );
    }
  }

  // Donut rectangular overlay
  if (s.showRects && (s.mode === "donut_rect" || s.mode === "donut_tri")) {
    if (s.donutRectOuter && s.donutRectInner) {
      // outer rect
      drawFilledRectBox(ctx, s.donutRectOuter, "rgba(0,0,0,0.08)", "rgba(0,0,0,0.6)", 2);
      // inner "hole"
      const box = s.donutRectInner;
      const iw = box.maxX - box.minX;
      const ih = box.maxY - box.minY;
      ctx.clearRect(box.minX, box.minY, iw, ih);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(box.minX, box.minY, iw, ih);
    }
  }

  // Donut circles
  if (s.showCircles && s.donutIsCircular && s.donutCircleOuter && s.donutCircleInner) {
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "purple";
    ctx.beginPath();
    ctx.arc(s.donutCircleOuter.cx, s.donutCircleOuter.cy, s.donutCircleOuter.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(s.donutCircleInner.cx, s.donutCircleInner.cy, s.donutCircleInner.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}


export { resizeCanvas, draw };
