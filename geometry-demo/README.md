SketchTiler Geometry Decomposition Demo

This project showcases a unified, browser-based demo of geometric preprocessing techniques relevant to the SketchTiler research project at UCSC.
The demo illustrates how rough user-drawn shapes can be converted into robust representations suitable for procedural generation, constraint-based layout, and Wave Function Collapse (WFC) pipelines.

The system supports arbitrary polygons, L-shapes, and donut-shapes (shapes with holes), and includes:

Grid snapping (orthogonalization of freehand sketches)

Rectangular decomposition

Triangulation decomposition

Bounding box generation

Donut classification (rectangular & circular donuts)

Visualization controls for before/after comparison

The goal is to make geometry preprocessing transparent, interactive, and demo-ready for presentations or research discussions.

🚀 Live Demo

Once GitHub Pages is enabled, the live demo will be available at:

https://stevex24.github.io/sketchtiler-geometry-demo/

✨ Features
1. Freehand Polygon Input

Users can sketch shapes directly on a canvas. The system automatically detects loops, cleans strokes, and forms polygons.

2. Orthogonal Grid Snapping

All examples use a grid (typically 25px) to snap strokes into rectilinear polygons, matching SketchTiler’s expectations.

3. L-Shape Decomposition

For L-shaped buildings:

Rectangular decomposition identifies two orthogonal rectangles

Triangulation decomposition shows triangle meshes and bounding boxes

4. Donut / Torus Shapes

When two loops are drawn:

Automatically classifies outer vs inner loop

Detects rectangular donuts (axis-aligned)

Detects circular donuts (roughly round shapes)

Shows triangulation for donut-shaped polygons

Culls triangles falling inside the hole

5. Arbitrary Polygon Decomposition

The unified pipeline supports:

Arbitrary simply connected polygons

Concave polygon triangulation

Convex region merging (optional future extension)

6. Visualization Controls

Each decomposition layer can be toggled on/off:

Raw polygon

Snapped polygon

Triangles (wireframe / filled / both)

Triangle bounding boxes

Rectangular overlays

Circular donut overlays

🧱 Project Structure
/
├── index.html          # Main integrated demo UI
├── css/
│   └── style.css       # Basic styling and UI layout
└── js/
    └── app.js          # Unified geometry engine


All geometry logic (snapping, triangulation, bounding boxes, donut detection, etc.) resides in app.js.

📦 Local Development

Clone the repo:

git clone https://github.com/stevex24/sketchtiler-geometry-demo.git
cd sketchtiler-geometry-demo


Run locally by simply opening index.html in your browser.

Or serve with a lightweight dev server:

python3 -m http.server

🧠 Research Context

This demo was created as part of exploratory geometry preprocessing experiments for the SketchTiler project:

Understanding why concave shapes cause WFC failures

Designing pre-WFC geometry sanitization routines

Identifying reliable bounding regions for tile templates

Experimenting with special-case geometries such as L-shapes and donuts

It is meant for presentations, reproducible demos, and communication with researchers.

🧩 Future Enhancements

Planned improvements:

Shape canonicalization and component labeling

Convex partitioning (Hertel–Mehlhorn, Greene’s algorithm)

Rectangular decomposition minimization

Stability checks for WFC pipeline integration

Export of regions as SketchTiler-compatible JSON

Screenshot export buttons for papers/presentations

🙏 Acknowledgments

Special thanks to the SketchTiler research team (including Blythe Chen and collaborators at UCSC) for inspiration, design goals, and feedback.
