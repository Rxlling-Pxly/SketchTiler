# Sketchtiler
**TODO: place example images with sketch and output side-by-sides**

SketchTiler is a tilemap generation tool that transforms hand-drawn sketches into structured, game-ready maps. It enables quick ideation and prototyping using a simple structure pen interface and wave function collapse.

**Ideal for:**
- Game level design
- Conceptual prototyping
- Creative sketch-to-map workflows

> This project is part of ongoing research. A link to our IEEE demo paper will be added here soon!

## How to use
Clone the repo and serve the project using any simple static server. For example:

**Using Python 3 (built-in):**
```bash
python -m http.server 8000
```
Then open [http://localhost:8000](http://localhost:8000) in your browser.

**Using npm (http-server):**
```bash
# install once if you don't have it
npm install -g http-server

# then, from the project root
http-server .
```
Then open the URL shown in your terminal (usually [http://localhost:8080](http://localhost:8080)).

**Using VS Code Live Server extension:**
- Right-click `index.html` → *Open with Live Server*.

## How it works
### Structure Pens + Metadata
In SketchTiler's sketchpad, structure pens ("House", "Forest") tag each stroke with structural metadata. This data helps define regions for generation.

SketchTiler then:
1. Parses these regions
2. Calls corresponding structure generators
3. Renders a suggestion layer

### Wave Function Collapse
All procedural generation in SketchTiler is powered by wave function collapse (WFC).

- *Structure generators*: Mini WFC models trained on example houses, forests, etc.
- *Suggestion Layer*: A general WFC model trained on full tilemaps. Suggests background context around user-defined structures.

**TODO: explain WFC + our implementation in more detail**

## Output
Use the export buttons to download sketch data and/or tilemap data. Each zip file contains a snapshot of the assiciated canvas and a JSON file containing data that can be used in future Sketchtiler sessions (sketch exports) or in a Phaser scene (map exports). 

**TODO: explain how to use exported map in a game**
**TODO: explain exporting/importing sketch data**

## Future work
- general improvements
- WFC improvements
- LLM integration
    - sketch-based suggestions

## Acknowledgements
- ADL
- Gumin WFC
- Tiny Town (Kenney)
- ?