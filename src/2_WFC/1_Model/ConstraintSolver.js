import DIRECTIONS from "./DIRECTIONS.js";
import BigBitmask from "./BigBitmask.js";
import Queue from "./Queue.js";
import PerformanceProfiler from "../../5_Utility/PerformanceProfiler.js";

export default class ConstraintSolver {
  /**
   * Represents the possibility space of an image in the middle of generation.
   * @type {Cell[][]}
   */
  waveMatrix;

  performanceProfiler = new PerformanceProfiler();

  /**
   * Attempts to solve this.waveMatrix based on learned pattern data.
   * @param {number[]} weights
   * @param {AdjacentPatternsMap[]} adjacencies
   * @param {SetTileInstruction[]} setTiles
   * @param {number} width The width to set this.waveMatrix to.
   * @param {number} height The height to set this.waveMatrix to.
   * @param {number} maxAttempts
   * @param {bool} logProgress Whether to log the progress of this function or not.
   * @param {bool} profile Whether to profile the performance of this function or not.
   * @returns {bool} Whether the attempt was successful or not.
   */
  solve(weights, adjacencies, setTileInstructions, width, height, maxAttempts, logProgress, profile) {
    this.performanceProfiler.clearData();
    this.profileFunctions(profile);

    this.initializeWaveMatrix(weights.length, width, height);
    this.setTiles(setTileInstructions, adjacencies);

    let numAttempts = 1;
    while (numAttempts <= maxAttempts) {	// use <= so maxAttempts can be 1
      const [y, x] = this.getLeastEntropyUnsolvedCellPosition(weights);
      if (y === -1 && x === -1) {
        if (logProgress) console.log(`solved in ${numAttempts} attempt(s)`);
        if (profile) this.performanceProfiler.logData();
        return true;
      }

      this.observe(y, x, weights);

      if (logProgress) console.log("propagating...");
      const contradictionCreated = this.propagate(y, x, adjacencies);
      if (contradictionCreated) {
        this.initializeWaveMatrix(weights.length, width, height);
        this.setTiles(setTileInstructions, adjacencies);
        numAttempts++;
      }
    }

    if (logProgress) console.log("max attempts reached");
    if (profile) this.performanceProfiler.logData();
    return false;
  }

  /**
   * Registers/unregisters important member functions to the performance profiler.
   * @param {bool} value Whether to profile (register) or not (unregister).
   */
  profileFunctions(value) {
    if (value) {
      this.initializeWaveMatrix = this.performanceProfiler.register(this.initializeWaveMatrix, false);
      this.setTiles = this.performanceProfiler.register(this.setTiles, false);
      this.getLeastEntropyUnsolvedCellPosition = this.performanceProfiler.register(this.getLeastEntropyUnsolvedCellPosition, false);
      this.getShannonEntropy = this.performanceProfiler.register(this.getShannonEntropy, true);
      this.observe = this.performanceProfiler.register(this.observe, false);
      this.propagate = this.performanceProfiler.register(this.propagate, false);
    } else {
      this.initializeWaveMatrix = this.performanceProfiler.unregister(this.initializeWaveMatrix);
      this.setTiles = this.performanceProfiler.unregister(this.setTiles);
      this.getLeastEntropyUnsolvedCellPosition = this.performanceProfiler.unregister(this.getLeastEntropyUnsolvedCellPosition);
      this.getShannonEntropy = this.performanceProfiler.unregister(this.getShannonEntropy);
      this.observe = this.performanceProfiler.unregister(this.observe);
      this.propagate = this.performanceProfiler.unregister(this.propagate);
    }
  }

  /**
   * Initializes each cell in this.waveMatrix to have every pattern be possible.
   * @param {number} numPatterns Used to create PossiblePatternBitmasks for cells.
   * @param {number} width The width to set this.waveMatrix to.
   * @param {number} height The height to set this.waveMatrix to.
   */
  initializeWaveMatrix(numPatterns, width, height) {
    this.waveMatrix = [];
    for (let y = 0; y < height; y++) this.waveMatrix[y] = [];

    const allPatternsPossible = new BigBitmask(numPatterns);
    for (let i = 0; i < numPatterns; i++) allPatternsPossible.setBit(i);

    for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      this.waveMatrix[y][x] = BigBitmask.createDeepCopy(allPatternsPossible);
    }}
  }

  /**
   * Executes the user's set tile instructions.
   * @param {SetTileInstruction[]} setTileInstructions 
   * @param {AdjacentPatternsMap[]} adjacencies
   */
  setTiles(setTileInstructions, adjacencies) {
    for (const [y, x, tilePatternsBitmask] of setTileInstructions) {
      if (y < 0 || y > this.waveMatrix.length-1 || x < 0 || x > this.waveMatrix[0].length-1) {
        console.warn("A set tile instruction asks for a position outside of the wave matrix. Ignoring this instruction.");
        continue;
      }
      this.waveMatrix[y][x].intersectWith(tilePatternsBitmask);
      const contradictionCreated = this.propagate(y, x, adjacencies);
      if (contradictionCreated) throw new Error("User's set tiles formed a contradiction.");
    }
  }

  /**
   * Returns the position of the least entropy unsolved (entropy > 0) cell. If all cells are solved, returns [-1, -1].
   * @param {number[]} weights
   * @returns {number[]} The position of the cell ([y, x]) or [-1, -1] if all cells are solved.
   */
  getLeastEntropyUnsolvedCellPosition(weights) {
    /*
      Build an array containing the positions of all cells tied with the least entropy
      Return the position of a random cell from that array
    */

    let leastEntropy = Infinity;
    let leastEntropyCellPositions = [];

    for (let y = 0; y < this.waveMatrix.length; y++) {
    for (let x = 0; x < this.waveMatrix[0].length; x++) {
      const entropy = this.getShannonEntropy(this.waveMatrix[y][x], weights);
      if (entropy < leastEntropy && entropy > 0) {
        leastEntropy = entropy;
        leastEntropyCellPositions = [[y, x]];
      }
      else if (entropy === leastEntropy) {
        leastEntropyCellPositions.push([y, x]);
      }
    }}

    const len = leastEntropyCellPositions.length;
    if (len > 0) return leastEntropyCellPositions[Math.floor(Math.random() * len)];	// random element (cell position)
    else return [-1, -1];
  }

  /**
   * Returns the Shannon Entropy of a cell using its possible patterns and those patterns' weights.
   * @param {PossiblePatternsBitmask} bitmask 
   * @param {number[]} weights 
   * @returns {number}
   */
  getShannonEntropy(bitmask, weights) {
    const possiblePatterns = bitmask.toArray();

    if (possiblePatterns.length === 0) throw new Error("Contradiction found.");
    if (possiblePatterns.length === 1) return 0;	// what the calculated result would have been

    let sumOfWeights = 0;
    let sumOfWeightLogWeights = 0;
    for (const i of possiblePatterns) {
      const w = weights[i];
      sumOfWeights += w;
      sumOfWeightLogWeights += w * Math.log(w);
    }

    return Math.log(sumOfWeights) - sumOfWeightLogWeights/sumOfWeights;
  }

  /**
   * Picks a pattern for a cell in this.waveMatrix to become.
   * @param {number} y The y position/index of the cell.
   * @param {number} x The x position/index of the cell.
   * @param {number[]} weights 
   */
  observe(y, x, weights) {
    // Uses weighted random
    // https://dev.to/jacktt/understanding-the-weighted-random-algorithm-581p

    const possiblePatterns = this.waveMatrix[y][x].toArray();

    const possiblePatternWeights = [];	// is parallel with possiblePatterns
    let totalWeight = 0;
    for (const i of possiblePatterns) {
      const w = weights[i];
      possiblePatternWeights.push(w);
      totalWeight += w;
    }

    const random = Math.random() * totalWeight;

    let cursor = 0;
    for (let i = 0; i < possiblePatternWeights.length; i++) {
      cursor += possiblePatternWeights[i];
      if (cursor >= random) {
        this.waveMatrix[y][x].clear();
        this.waveMatrix[y][x].setBit(possiblePatterns[i]);
        return;
      }
    }

    throw new Error("A pattern wasn't chosen within the for loop");
  }

  /**
   * Adjusts the possible patterns of each cell affected by the observation of a cell.
   * @param {number} y The y position/index of the observed cell.
   * @param {number} x The x position/index of the observed cell.
   * @param {AdjacentPatternsMap[]} adjacencies
   * @returns {boolean} Whether a contradiction was created or not.
   */
  propagate(y, x, adjacencies) {
    const queue = new Queue();
    queue.enqueue([y, x]);

    while (queue.length > 0) {
      const [y1, x1] = queue.dequeue();
      const cell1_PossiblePatterns_Array = this.waveMatrix[y1][x1].toArray();

      for (let k = 0; k < DIRECTIONS.length; k++) {	// using k because k is associated with iterating over DIRECTIONS in the ImageProcessor class
        /*
          Given two adjacent cells: cell1 at (y1, x1) and cell2 at (y2, x2)

          Get cell2's currernt possible patterns
          Use the adjacency data of cell1's possible patterns to build a set of all possible patterns cell2 can be
          Create an array for cell2's new possible patterns by taking the shared elements between the two aforementioned data structures 

          If cell2's new possible patterns is the same size as its current: there were no changes - do nothing
          If cell2's new possible patterns is empty: there are no possible patterns cell2 can be - return contradiction
          If cell2's new possible patterns is smaller than its current: there were changes - enqueue cell2 so its adjacent cells can also be adjusted
        */

        const dir = DIRECTIONS[k];
        const dy = -dir[0];	// need to reverse direction or else output will be upside down
        const dx = -dir[1];	// need to reverse direction or else output will be upside down
        const y2 = y1+dy;
        const x2 = x1+dx;

        // Don't go out of bounds
        if (y2 < 0 || y2 > this.waveMatrix.length-1 || x2 < 0 || x2 > this.waveMatrix[0].length-1) continue;

        const cell2_PossiblePatterns_Bitmask = this.waveMatrix[y2][x2];

        const cell1_PossibleAdjacentPatterns_Bitmask = new BigBitmask(adjacencies.length);
        for (const i of cell1_PossiblePatterns_Array) {
          const i_AdjacentPatterns_Bitmask = adjacencies[i][k];
          cell1_PossibleAdjacentPatterns_Bitmask.mergeWith(i_AdjacentPatterns_Bitmask);
        }

        const cell2_NewPossiblePatterns_Bitmask = BigBitmask.AND(cell2_PossiblePatterns_Bitmask, cell1_PossibleAdjacentPatterns_Bitmask);

        const contradictionCreated = cell2_NewPossiblePatterns_Bitmask.isEmpty();
        if (contradictionCreated) return true;
        
        const cell2Changed = !BigBitmask.EQUALS(cell2_PossiblePatterns_Bitmask, cell2_NewPossiblePatterns_Bitmask);
        if (cell2Changed) {
          this.waveMatrix[y2][x2] = cell2_NewPossiblePatterns_Bitmask;
          queue.enqueue([y2, x2]);
        }
      }
    }
    return false;	// no contradiction created
  }
}