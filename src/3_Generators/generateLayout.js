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
        for (let box of regions[type]) {
            if (Array.isArray(box)) {
                // trace
                for (let point of box) {
                    model.setTile(point.x, point.y, colortiles[type.toLowerCase()].FILL);
                }
            } else {
                // box
                placeStructureInLayout(type.toLowerCase(), box, model);
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