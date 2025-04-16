// Takes in an array of tile coordinates
class FenceGenerator {
    FENCE_UP = 1;
    FENCE_DOWN = 2;
    FENCE_RIGHT = 3;
    FENCE_LEFT = 4;
    FENCE_UPRIGHT = 5;
    FENCE_UPLEFT = 6;
    FENCE_DOWNRIGHT = 7;
    FENCE_DOWNLEFT = 8;
    BLANK = 0;


    constructor(coordinateList) {
        // contains list of tiles where the sketch touched
        this.outlineTileList = coordinateList;
        this.tileArray = [];
	}

    // Get the overall bounding box of the region
    getBoundingBox() {
		let minX = this.outlineTileList[0].x;
		let maxX = this.outlineTileList[0].x;
		let minY = this.outlineTileList[0].y;
		let maxY = this.outlineTileList[0].y;

		for (const { x, y } of this.coordinateList) {
			if (x < minX) minX = x;
			else if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			else if (y > maxY) maxY = y;
		}

		return {
			topLeft: { minX, minY },
			bottomRight: { maxX, maxY }
		};
	}

    // Make an initial tile array that blocks out which tiles are empty and which have a fence tile
    makeInitialTileArray() {
        let minX = getBoundingBox().topLeft[0];
        let minY = getBoundingBox().topLeft[1];
        let maxX = getBoundingBox().bottomRight[0];
        let maxY = getBoundingBox().bottomRight[1];

        // loop through top to bottom
        for (let i = minY; i <= maxY; i++) {
            this.tileArray.push([]);
            
            // loop through left to right
            for (let j = minX; j <= maxX; j++) {
                let tileID = this.BLANK;

                if (this.outlineTileList.includes({j, i})) {
                    tileID = this.FENCE_UP;
                }

                const tileInfo = {
                    id: tileID,
                    coords: {j, i}
                }
                
                this.tileArray[i].push(tileInfo);
            }
        }
    }

    setTransitions() {
        // corners
        let topLeft = XYZ;
        let topRight = XYZ;

        // go row by row, find the tiles closest to each of the four corners per row
        for (let i = 0; i < this.tileArray[0].length; i++) {

        }
    }
}