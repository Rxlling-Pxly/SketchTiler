import WFCModel from "../2_WFC/1_Model/wfcModel.js";
import IMAGES from "../2_WFC/2_Input/images.js";
import TILEMAP from "../4_Phaser/tilemap.js";
import Layout from "../5_Utility/getWorldLayout.js";
import STRUCTURE_TILES from "../4_Phaser/structureTiles.js";

const colortiles = TILEMAP["color_tiles"];
const tilesetInfo = TILEMAP["tiny_town"];

/**
 * @param {BoundingBox} regions
 * @returns {TilemapImage}
 */
export default function generateLayout(regions, detectStructuresID, placeStructuresID, minStructreSize, preventOverlaps = false) {
    const layouts = learnLayout(detectStructuresID, placeStructuresID, minStructreSize, preventOverlaps);
    const model = new WFCModel().learn(layouts, 2);
    
    for(let type in regions){
        for(let box of regions[type]){
            placeStructureInLayout(type.toLowerCase(), box, model);
        }
    }
    
    // generate layout
    const map = model.generate(tilesetInfo.WIDTH, tilesetInfo.HEIGHT, 10, false, false);

    if (!map){ 
        console.error("Contradiction created");
        return false;
    }

    const layout = new Layout(
        map,
        minStructreSize, 
        STRUCTURE_TILES[placeStructuresID],
        STRUCTURE_TILES[placeStructuresID],
        minStructreSize,
        preventOverlaps
    );

    return layout;
}

/**
 * Train layout model on structure layouts.
 * 
 * @param {string} detectStructuresID - Key for STRUCTURE_TILES to use.
 */
function learnLayout(detectStructuresID, placeStructuresID, minStructreSize, preventOverlaps){
    let layouts = []

    // create layouts from structure maps
    for(let structureMap of IMAGES.STRUCTURES){
        const mapLayout = new Layout(
            structureMap,
            minStructreSize, 
            STRUCTURE_TILES[detectStructuresID],
            STRUCTURE_TILES[placeStructuresID],
            preventOverlaps
        );

        layouts.push(mapLayout.getLayoutMap());
    }

    // Add augmented layouts to learn adjacent/nested structures
    layouts.push(...generateAugmentedLayouts());

    return layouts;
}

/**
 * Generates synthetic layouts that force the WFC model to learn that
 * all structure types can be adjacent to and nested within each other.
 */
function generateAugmentedLayouts() {
    const types = Object.keys(colortiles).filter(t => colortiles[t].TOP_LEFT); // Only types with full definition
    const layouts = [];
    const size = 20;

    // Helper to create a blank map
    const createMap = () => Array.from({ length: size }, () => Array(size).fill(0));

    // 1. Learn nesting and adjacency between all pairs of structures
    for (const typeA of types) {
        for (const typeB of types) {
            // Case 1: Nested (B inside A)
            let mapRec = createMap();
            drawStructure(mapRec, typeA, 2, 2, 16, 16); // Large outer
            drawStructure(mapRec, typeB, 6, 6, 8, 8);   // Small inner
            layouts.push(mapRec);

            // Case 2: Adjacent (Side by Side)
            let mapAdj = createMap();
            drawStructure(mapAdj, typeA, 2, 2, 8, 16);  // Left
            drawStructure(mapAdj, typeB, 10, 2, 8, 16); // Right
            layouts.push(mapAdj);

            // Case 3: Overlapping
            let mapOver = createMap();
            drawStructure(mapOver, typeA, 2, 2, 10, 10); // Top-Left
            drawStructure(mapOver, typeB, 8, 8, 10, 10); // Bottom-Right
            layouts.push(mapOver);
        }
        
        // Case 4: Structure containing Empty/Void (Hole)
        let mapHole = createMap();
        drawStructure(mapHole, typeA, 2, 2, 16, 16);
        // Clear center to 0
        for(let y=6; y<14; y++) {
            for(let x=6; x<14; x++) {
                mapHole[y][x] = 0;
            }
        }
        layouts.push(mapHole);
    }

    return layouts;
}

/**
 * Draws a structure of a given type onto a 2D map array.
 */
function drawStructure(map, type, x, y, w, h) {
    const tiles = colortiles[type];
    if (!tiles) return;

    const right = x + w - 1;
    const bottom = y + h - 1;

    // Corners
    if (x >= 0 && x < map[0].length && y >= 0 && y < map.length) map[y][x] = tiles.TOP_LEFT[0];
    if (right >= 0 && right < map[0].length && y >= 0 && y < map.length) map[y][right] = tiles.TOP_RIGHT[0];
    if (x >= 0 && x < map[0].length && bottom >= 0 && bottom < map.length) map[bottom][x] = tiles.BOTTOM_LEFT[0];
    if (right >= 0 && right < map[0].length && bottom >= 0 && bottom < map.length) map[bottom][right] = tiles.BOTTOM_RIGHT[0];

    // Borders & Fill
    for (let i = x + 1; i < right; i++) {
        for (let j = y + 1; j < bottom; j++) {
            if (i >= 0 && i < map[0].length && j >= 0 && j < map.length) {
                map[j][i] = tiles.FILL[0];
            }
        }
        // Top/Bottom Borders
        if (i >= 0 && i < map[0].length) {
            if (y >= 0 && y < map.length) map[y][i] = tiles.TOP[0];
            if (bottom >= 0 && bottom < map.length) map[bottom][i] = tiles.BOTTOM[0];
        }
    }
    for (let j = y + 1; j < bottom; j++) {
        // Left/Right Borders
        if (j >= 0 && j < map.length) {
            if (x >= 0 && x < map[0].length) map[j][x] = tiles.LEFT[0];
            if (right >= 0 && right < map[0].length) map[j][right] = tiles.RIGHT[0];
        }
    }
}

function placeStructureInLayout(type, boundingBox, model){
    const tlX = boundingBox.topLeft.x;
    const tlY = boundingBox.topLeft.y;
    const brX = boundingBox.bottomRight.x;
    const brY = boundingBox.bottomRight.y;

    const w = boundingBox.width;
    const h = boundingBox.height;

    // place corners
    model.setTile(tlX, tlY, colortiles[type].TOP_LEFT);
    model.setTile(brX, tlY, colortiles[type].TOP_RIGHT);
    model.setTile(tlX, brY, colortiles[type].BOTTOM_LEFT);
    model.setTile(brX, brY, colortiles[type].BOTTOM_RIGHT);

    // place borders
    // top and bottom
    for (let x = tlX + 1; x < brX; x++) {
        model.setTile(x, tlY, colortiles[type].TOP);
        model.setTile(x, brY, colortiles[type].BOTTOM);
    }

    // left and right
    for (let y = tlY + 1; y < brY; y++) {
        model.setTile(tlX, y, colortiles[type].LEFT);
        model.setTile(brX, y, colortiles[type].RIGHT);
    }
}