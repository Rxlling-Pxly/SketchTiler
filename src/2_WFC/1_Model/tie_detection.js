import DIRECTIONS from "./DIRECTIONS.js";
import Bitmask from "./Bitmask.js";
import Queue from "./Queue.js";
import PerformanceProfiler from "../../5_Utility/PerformanceProfiler.js";


export default class ConstraintSolver {
  /**
   * Represents the possibility space of an image in the middle of generation.
   * @type {Cell[][]}
   */
  useNoise = true; // false = use random, true = use noise
  noiseStrength = 0.1;
  noiseFunction = (x, y) => Math.random(); // Replace with simplex or smoother later

  waveMatrix;

  performanceProfiler = new PerformanceProfiler();
  
  // NEW: Tie frequency tracking
  tieStats = {
    totalObservations: 0,
    tieOccurrences: [],  // Array of tie counts for each observation
    entropyDistribution: new Map(), // entropy value -> frequency
    maxTiesInSingleObservation: 0,
    totalCellsWithLowestEntropy: 0
  };

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
   * @param {bool} analyzeTies Whether to analyze tie frequency or not.
   * @returns {bool} Whether the attempt was successful or not.
   */
  solve(weights, adjacencies, setTileInstructions, width, height, maxAttempts, logProgress, profile, analyzeTies = false) {
    this.performanceProfiler.clearData();
    this.profileFunctions(profile);
    
    // Reset tie statistics
    if (analyzeTies) {
      this.resetTieStats();
    }

    this.initializeWaveMatrix(weights.length, width, height);
    this.setTiles(setTileInstructions, adjacencies);

let numAttempts = 1;
let steps = 0;
const stepLimit = 1000;

while (numAttempts <= maxAttempts) {
  console.log(`Attempt ${numAttempts}, step ${steps}`);

  if (++steps > stepLimit) {
    console.log("⛔️ Step limit reached, exiting early to avoid infinite loop.");
    break;
  }

  const [y, x] = analyzeTies ?
    this.getLeastEntropyUnsolvedCellPositionWithAnalysis(weights) :
    this.getLeastEntropyUnsolvedCellPosition(weights);

  if (y === -1 && x === -1) {
    if (logProgress) console.log(`solved in ${numAttempts} attempt(s)`);
    if (profile) this.performanceProfiler.logData();
    if (analyzeTies) this.logTieAnalysis();
    return true;
  }

  console.log(`🔍 Observing cell (${y}, ${x}) and starting propagation`);
  this.observe(y, x, weights);

  if (logProgress) console.log("propagating...");
  const contradictionCreated = this.propagate(y, x, adjacencies);
  if (contradictionCreated) {
    this.initializeWaveMatrix(weights.length, width, height);
    this.setTiles(setTileInstructions, adjacencies);
    numAttempts++;
    if (analyzeTies) this.resetTieStats();
  }
}


    if (logProgress) console.log("max attempts reached");
    if (profile) this.performanceProfiler.logData();
    if (analyzeTies) this.logTieAnalysis();
    return false;
  }

  /**
   * NEW: Reset tie tracking statistics
   */
  resetTieStats() {
    this.tieStats = {
      totalObservations: 0,
      tieOccurrences: [],
      entropyDistribution: new Map(),
      maxTiesInSingleObservation: 0,
      totalCellsWithLowestEntropy: 0
    };
  }

  /**
   * NEW: Enhanced version that tracks tie frequency
   */
  getLeastEntropyUnsolvedCellPositionWithAnalysis(weights) {
    let leastEntropy = Infinity;
    let leastEntropyCellPositions = [];
    let entropyFrequency = new Map(); // Track how many cells have each entropy value

    for (let y = 0; y < this.waveMatrix.length; y++) {
      for (let x = 0; x < this.waveMatrix[0].length; x++) {
        let entropy = this.getShannonEntropy(this.waveMatrix[y][x], weights);
        if (this.useNoise && entropy > 0) {
            const noise = this.noiseFunction(x, y);
            entropy += this.noiseStrength * noise;
    }


        const noise = this.noiseFunction ? this.noiseFunction(x, y) : Math.random(); // Replace with simplex or seed-based noise if desired
        entropy += (this.noiseStrength || 0.0) * noise;

       
        
        // Track entropy distribution
        entropyFrequency.set(entropy, (entropyFrequency.get(entropy) || 0) + 1);
        
        if (entropy < leastEntropy && entropy > 0) {
          leastEntropy = entropy;
          leastEntropyCellPositions = [[y, x]];
        }
        else if (entropy === leastEntropy) {
          leastEntropyCellPositions.push([y, x]);
        }
      }
    }

    // Record statistics
    if (leastEntropyCellPositions.length > 0) {
      this.tieStats.totalObservations++;
      const numTies = leastEntropyCellPositions.length;
      this.tieStats.tieOccurrences.push(numTies);
      this.tieStats.maxTiesInSingleObservation = Math.max(this.tieStats.maxTiesInSingleObservation, numTies);
      this.tieStats.totalCellsWithLowestEntropy += numTies;
      
      // Record entropy distribution for this observation
      
      const roundedEntropy = Math.round(leastEntropy * 1000) / 1000; // 3 decimal places
        this.tieStats.entropyDistribution.set(
            roundedEntropy,
            (this.tieStats.entropyDistribution.get(roundedEntropy) || 0) + 1
);

      
      return leastEntropyCellPositions[Math.floor(Math.random() * numTies)];
    }
    
    return [-1, -1];
  }

  /**
   * NEW: Log comprehensive tie analysis
   */
  logTieAnalysis() {
    const stats = this.tieStats;
    console.log("\n=== WFC TIE FREQUENCY ANALYSIS ===");
    console.log(`Total observations: ${stats.totalObservations}`);
    
    if (stats.totalObservations === 0) {
      console.log("No observations recorded.");
      return;
    }

    // Basic tie statistics
    const avgTies = stats.totalCellsWithLowestEntropy / stats.totalObservations;
    console.log(`Average cells with lowest entropy per observation: ${avgTies.toFixed(2)}`);
    console.log(`Maximum ties in single observation: ${stats.maxTiesInSingleObservation}`);
    
    // Tie frequency distribution
    const tieFrequency = new Map();
    stats.tieOccurrences.forEach(ties => {
      tieFrequency.set(ties, (tieFrequency.get(ties) || 0) + 1);
    });
    
    console.log("\nTie frequency distribution:");
    const sortedTies = Array.from(tieFrequency.entries()).sort((a, b) => a[0] - b[0]);
    sortedTies.forEach(([numTies, frequency]) => {
      const percentage = ((frequency / stats.totalObservations) * 100).toFixed(1);
      console.log(`  ${numTies} ties: ${frequency} times (${percentage}%)`);
    });
    
    // Percentage of observations with ties (>1 cell)
    const observationsWithTies = stats.tieOccurrences.filter(ties => ties > 1).length;
    const tiePercentage = ((observationsWithTies / stats.totalObservations) * 100).toFixed(1);
    console.log(`\nObservations with ties (>1 cell): ${observationsWithTies}/${stats.totalObservations} (${tiePercentage}%)`);
    
    // Entropy distribution
    console.log("\nLowest entropy values encountered:");
    const sortedEntropies = Array.from(stats.entropyDistribution.entries()).sort((a, b) => a[0] - b[0]);
    sortedEntropies.slice(0, 10).forEach(([entropy, frequency]) => {
      console.log(`  ${entropy.toFixed(4)}: ${frequency} times`);
    });
    
    // Analysis insights
    console.log("\n=== INSIGHTS ===");
    if (tiePercentage > 50) {
      console.log("🔴 High tie frequency - Random tie-breaking is CRITICAL for output variety");
    } else if (tiePercentage > 20) {
      console.log("🟡 Moderate tie frequency - Random tie-breaking provides noticeable benefit");
    } else {
      console.log("🟢 Low tie frequency - Random tie-breaking has minimal impact");
    }
    
    if (stats.maxTiesInSingleObservation > 10) {
      console.log("📊 Large tie groups detected - Consider noise-based tie-breaking for performance");
    }
    
    console.log("=======================================\n");
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

    const allPatternsPossible = new Bitmask(numPatterns);
    for (let i = 0; i < numPatterns; i++) allPatternsPossible.setBit(i);

    for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      this.waveMatrix[y][x] = Bitmask.createCopy(allPatternsPossible);
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
        let entropy = this.getShannonEntropy(this.waveMatrix[y][x], weights);
        if (this.useNoise && entropy > 0) {
            const noise = this.noiseFunction(x, y);
            entropy += this.noiseStrength * noise;
    }

        const noise = this.noiseFunction ? this.noiseFunction(x, y) : Math.random(); // Replace with simplex or seed-based noise if desired
        entropy += (this.noiseStrength || 0.0) * noise;

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

        const cell1_PossibleAdjacentPatterns_Bitmask = new Bitmask(adjacencies.length);
        for (const i of cell1_PossiblePatterns_Array) {
          const i_AdjacentPatterns_Bitmask = adjacencies[i][k];
          cell1_PossibleAdjacentPatterns_Bitmask.mergeWith(i_AdjacentPatterns_Bitmask);
        }

        const cell2_NewPossiblePatterns_Bitmask = Bitmask.AND(cell2_PossiblePatterns_Bitmask, cell1_PossibleAdjacentPatterns_Bitmask);

        const contradictionCreated = cell2_NewPossiblePatterns_Bitmask.isEmpty();
        if (contradictionCreated) return true;
        
        const cell2Changed = !Bitmask.EQUALS(cell2_PossiblePatterns_Bitmask, cell2_NewPossiblePatterns_Bitmask);
        if (cell2Changed) {
          this.waveMatrix[y2][x2] = cell2_NewPossiblePatterns_Bitmask;
          queue.enqueue([y2, x2]);
        }
      }
    }
    return false;	// no contradiction created
  }
}