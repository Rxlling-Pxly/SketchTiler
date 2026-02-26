import WFCModel from "../2_WFC/1_Model/wfcModel.js";
import IMAGES from "../2_WFC/2_Input/images.js";
import TILEMAP from "../4_Phaser/3_Utils/tilemap.js";
import Layout from "../5_Utility/getWorldLayout.js";
import STRUCTURE_TILES from "../4_Phaser/3_Utils/structureTiles.js";

const colortiles = TILEMAP["color_tiles"];
const tilesetInfo = TILEMAP["tiny_town"];

/**
 * @param {BoundingBox} regions
 * @param {string[]} [layerTypes] - If provided, only keep these structure types in training data (others become void)
 * @returns {TilemapImage}
 */
export default function generateLayout(regions, detectStructuresID, placeStructuresID, minStructreSize, preventOverlaps = false, layerTypes = null) {
    const layouts = learnLayout(detectStructuresID, placeStructuresID, minStructreSize, preventOverlaps, layerTypes);
    const model = new WFCModel().learn(layouts, 2);

    for (let type in regions) {
        const typeLower = type.toLowerCase();
        if (!colortiles[typeLower]) continue;

        for (let box of regions[type]) {
            if (Array.isArray(box)) {
                // trace
                for (let point of box) {
                    safeSetTile(model, point.x, point.y, colortiles[typeLower].FILL);
                }
            } else {
                // box
                placeStructureInLayout(typeLower, box, model);
            }
        }
    }

    // generate layout
    let map;
    try {
        map = model.generate(tilesetInfo.WIDTH, tilesetInfo.HEIGHT, 10, false, false);
    } catch (error) {
        console.warn("Layout generation failed with error:", error);
        return false;
    }

    if (!map) {
        console.warn("Layout contradiction — will retry or fall back to layered generation");
        return false;
    }

    const layout = new Layout(
        map,
        minStructreSize,
        STRUCTURE_TILES[placeStructuresID],
        STRUCTURE_TILES[placeStructuresID],
        preventOverlaps
    );

    return layout;
}

/**
 * Train layout model on structure layouts.
 * 
 * @param {string} detectStructuresID - Key for STRUCTURE_TILES to use.
 */
function learnLayout(detectStructuresID, placeStructuresID, minStructreSize, preventOverlaps, layerTypes) {
    let layouts = []

    // Collect tile IDs that belong to types NOT in this layer, so we can replace them with void (0)
    let excludedTileIDs = null;
    if (layerTypes) {
        excludedTileIDs = new Set();
        const placeStructures = STRUCTURE_TILES[placeStructuresID];
        for (const type in placeStructures) {
            if (type === 'void') continue;
            if (!layerTypes.includes(type)) {
                for (const id of placeStructures[type].tileIDs) {
                    excludedTileIDs.add(id);
                }
            }
        }
    }

    // create layouts from structure maps
    for (let structureMap of IMAGES.STRUCTURES) {
        const mapLayout = new Layout(
            structureMap,
            minStructreSize,
            STRUCTURE_TILES[detectStructuresID],
            STRUCTURE_TILES[placeStructuresID],
            preventOverlaps
        );

        let layoutMap = mapLayout.getLayoutMap();

        // Replace excluded structure tiles with void (0) so WFC only learns this layer's patterns
        if (excludedTileIDs) {
            layoutMap = layoutMap.map(row =>
                row.map(tile => excludedTileIDs.has(tile) ? 0 : tile)
            );
        }

        layouts.push(layoutMap);
    }

    return layouts;
}

function placeStructureInLayout(type, boundingBox, model) {
    if (!colortiles[type] || !boundingBox || !boundingBox.topLeft || !boundingBox.bottomRight) return;

    const tlX = boundingBox.topLeft.x;
    const tlY = boundingBox.topLeft.y;
    const brX = boundingBox.bottomRight.x;
    const brY = boundingBox.bottomRight.y;

    const w = boundingBox.width;
    const h = boundingBox.height;

    // place corners
    safeSetTile(model, tlX, tlY, colortiles[type].TOP_LEFT);
    safeSetTile(model, brX, tlY, colortiles[type].TOP_RIGHT);
    safeSetTile(model, tlX, brY, colortiles[type].BOTTOM_LEFT);
    safeSetTile(model, brX, brY, colortiles[type].BOTTOM_RIGHT);

    // place borders
    // top and bottom
    for (let x = tlX + 1; x < brX; x++) {
        safeSetTile(model, x, tlY, colortiles[type].TOP);
        safeSetTile(model, x, brY, colortiles[type].BOTTOM);
    }

    // left and right
    for (let y = tlY + 1; y < brY; y++) {
        safeSetTile(model, tlX, y, colortiles[type].LEFT);
        safeSetTile(model, brX, y, colortiles[type].RIGHT);
    }
}

function inBounds(x, y) {
    return x >= 0 && x < tilesetInfo.WIDTH && y >= 0 && y < tilesetInfo.HEIGHT;
}

function safeSetTile(model, x, y, tileIDs) {
    if (!inBounds(x, y)) return;
    model.setTile(x, y, tileIDs);
}
