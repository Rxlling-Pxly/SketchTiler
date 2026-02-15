import WFCModel from "../2_WFC/1_Model/wfcModel.js";
import IMAGES from "../2_WFC/2_Input/images.js";
import TILEMAP from "../4_Phaser/tilemap.js";

const model = new WFCModel().learn(IMAGES.HOUSES, 2);
const tinytown = TILEMAP["tiny_town"];

/**
 * @param {BoundingBox} boundingBox
 * @returns {TilemapImage}
 */
export default function generateHouse(boundingBox) {
  const { width, height } = boundingBox;

  try {
    model.clearSetTiles();
    model.setTile(0, 0, tinytown.HOUSE_TOP_LEFT_TILES);
    model.setTile(width - 1, 0, tinytown.HOUSE_TOP_RIGHT_TILES);
    model.setTile(0, height - 1, tinytown.HOUSE_BOTTOM_LEFT_TILES);
    model.setTile(width - 1, height - 1, tinytown.HOUSE_BOTTOM_RIGHT_TILES);

    // Only place door if width is sufficient (>= 3 for single door with corners)
    if (width >= 3) {
      setDoorRandomlyAtBottom(width, height);
    }

    const house = model.generate(width, height, 10, false, false);
    if (!house) {
      console.error("Contradiction created");
      return false;
    }
    return house;
  } catch (error) {
    console.warn("House generation failed with error:", error);
    return false;
  }
}

function setDoorRandomlyAtBottom(width, height) {
  // Ensure x is not on corners (0 and width-1)
  const x = randIntInRange(1, width - 1);

  if (width === 3) {
    model.setTile(x, height - 1, tinytown.HOUSE_DOOR_TILES);
  } else {
    // If width is larger, we have more flexibility.
    // Avoid placing double doors if they would overlap with the right corner (width-1)
    if (x === width - 2) {
      // Only space for right part of double door or single door? 
      // Actually, if x is width-2, double door takes x and x+1. x+1 is width-1 (corner).
      // So double door fits only if x < width-2.
      model.setTile(x, height - 1, tinytown.HOUSE_DOOR_TILES);
    }
    else {
      model.setTile(x, height - 1, [...tinytown.HOUSE_DOOR_TILES, ...tinytown.HOUSE_DOUBLE_DOOR_LEFT_TILES]);
    }
  }
}

/**
 * Returns a random integer in the range [min, max). 
 * @param {number} min Must be an integer.
 * @param {number} max Must be an integer.
 * @returns {number}
*/
function randIntInRange(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}