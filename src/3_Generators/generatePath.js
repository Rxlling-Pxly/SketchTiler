import WFCModel from "../2_WFC/1_Model/wfcModel.js";
import IMAGES from "../2_WFC/2_Input/images.js";
import TILEMAP from "../4_Phaser/3_Utils/tilemap.js";

const tinytown = TILEMAP["tiny_town"];

/**
 * @param {Object} structure - The structure object from worldFacts
 * @returns {number[][]} - 2D array of tile IDs for the path
 */
export default function generatePath(structure) {
    const { width, height, topLeft } = structure.boundingBox;

    // Create WFC model for paths
    const model = new WFCModel().learn(IMAGES.PATHS, 2);

    // Generate path texture for the bounding box
    const generatedPath = model.generate(width, height, 10, false, false);

    if (!generatedPath) {
        console.warn("Path generation failed (contradiction)");
        return false;
    }

    // Mask the generated path: keep tiles only where the trace exists
    // Initialize result with VOID (-1)
    const result = Array.from({ length: height }, () => Array(width).fill(-1));

    if (structure.trace) {
        for (let point of structure.trace) {
            // Convert global coordinates to local coordinates relative to bounding box
            const localX = point.x - topLeft.x;
            const localY = point.y - topLeft.y;

            // Check bounds just in case
            if (localX >= 0 && localX < width && localY >= 0 && localY < height) {
                result[localY][localX] = generatedPath[localY][localX];
            }
        }
    } else {
        // Fallback for box regions (unlikely for paths but good for robustness)
        return generatedPath;
    }

    return result;
}
