import WFCModel from "../2_WFC/1_Model/wfcModel.js";
import IMAGES from "../2_WFC/2_Input/images.js";
import TILEMAP from "../4_Phaser/tilemap.js";

const tinytown = TILEMAP["tiny_town"];

/**
 * @param {number[][]} structsLayer - The structures layer
 * @param {Array} pathTraces - Array of path trace regions from user sketch
 * @returns {TilemapImage}
 */
export default function generatePaths(structsLayer, pathTraces) {
  console.log("=== generatePaths called ===");
  console.log("IMAGES.PATHS:", IMAGES.PATHS);
  console.log("tinytown.PATH:", tinytown.PATH);
  console.log("Path traces from user:", pathTraces);
  
  // If no paths were drawn, return empty layer
  if (!pathTraces || pathTraces.length === 0) {
    console.log("No paths drawn by user");
    return Array.from({ length: tinytown.HEIGHT }, () => 
      Array(tinytown.WIDTH).fill(-1)
    );
  }

  // Convert user-drawn path traces into training image
  const userPathImage = createPathImageFromTraces(pathTraces);
  console.log("User path training image created");

  // Train WFC on user's path drawing + existing examples
  const model = new WFCModel().learn([userPathImage, ...IMAGES.PATHS], 2);
  model.clearSetTiles();
  
  // place path tiles at all doors
  let doorLocations = findDoors(structsLayer);
  console.log("Door locations found:", doorLocations);
  console.log("Training image sample (row 12):", userPathImage[12]);
  
  for(let door of doorLocations){
    if(door.y + 1 < tinytown.HEIGHT){
      console.log(`Setting path tile at (${door.x}, ${door.y + 1})`);
      model.setTile(door.x, door.y + 1, tinytown.PATH);
    }
  }
    

  // generate paths
  const paths = model.generate(tinytown.WIDTH, tinytown.HEIGHT, 10, false, false);
  console.log("Raw paths result:", paths);

  if (paths) {
    console.log("Paths generated successfully");
  }

  if (!paths){ 
    console.error("Contradiction created");
    return false;
  }

  return paths;
}

/**
 * Convert user-drawn path traces into a tilemap image for WFC training
 * Makes paths thicker so WFC learns better connectivity patterns
 */
function createPathImageFromTraces(pathTraces) {
  console.log("=== createPathImageFromTraces called ===");
  
  // Create empty map
  const image = Array.from({ length: tinytown.HEIGHT }, () => 
    Array(tinytown.WIDTH).fill(-1)
  );
  
  // Fill in path tiles where user drew
  const pathTileIDs = tinytown.PATH; // [40, 41, 42, 43, 44]
  
  let tilesPlaced = 0;
  
  for(let trace of pathTraces) {
    console.log("Processing trace with", trace.length, "points");
    
    for(let point of trace) {
      // Make path MUCH thicker (5x5 around each point) for better training
      for(let dy = -2; dy <= 2; dy++) {
        for(let dx = -2; dx <= 2; dx++) {
          const ny = point.y + dy;
          const nx = point.x + dx;
          
          if(ny >= 0 && ny < tinytown.HEIGHT && 
             nx >= 0 && nx < tinytown.WIDTH) {
            const tile = pathTileIDs[Math.floor(Math.random() * pathTileIDs.length)];
            image[ny][nx] = tile;
            tilesPlaced++;
          }
        }
      }
    }
  }
  
  console.log("Total tiles placed:", tilesPlaced);
  console.log("Sample row from training image (row 20):", image[20]);
  
  return image;
}

function findDoors(layer) {
  let result = [];

  // scan layer for doors
  for(let y = 0; y < layer.length; y++){
    for(let x = 0; x < layer[y].length; x++){
      if(isDoor(layer[y][x])){ result.push({x, y}); }
    }
  }

  return result;
}

function isDoor(id){
  if( tinytown.HOUSE_DOOR_TILES.includes(id) || 
      tinytown.HOUSE_DOUBLE_DOOR_LEFT_TILES.includes(id) || 
      tinytown.HOUSE_DOUBLE_DOOR_RIGHT_TILES.includes(id)  
  ){ return true; }

  return false;
}
