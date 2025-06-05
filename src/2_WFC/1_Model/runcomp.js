import ConstraintSolver from "./tie_detection.js";
import Bitmask from './bitmask.js';



// Stub/mock inputs for testing (you need to provide your actual weights, adjacencies, setTiles, etc.)
const weights = [1, 1, 1, 1]; // 4 equal-weight patterns
const adjacencies = [
  // Dummy adjacency for each pattern and direction (e.g., 4 patterns × 4 directions)
  [new Bitmask(4), new Bitmask(4), new Bitmask(4), new Bitmask(4)],
  [new Bitmask(4), new Bitmask(4), new Bitmask(4), new Bitmask(4)],
  [new Bitmask(4), new Bitmask(4), new Bitmask(4), new Bitmask(4)],
  [new Bitmask(4), new Bitmask(4), new Bitmask(4), new Bitmask(4)],
];
for (let i = 0; i < 4; i++) {
  for (let d = 0; d < 4; d++) {
    adjacencies[i][d].setBit(i); // Each pattern can only connect to itself
  }
}
const setTiles = [];

// const setTiles = []; // optional hardcoded tile positions
const width = 25;
const height = 25;
const maxAttempts = 10;

function runAndLog(solver, label) {
  const success = solver.solve(weights, adjacencies, setTiles, width, height, maxAttempts, false, false, true);
  console.log(`\n=== ${label} ===`);
  if (success) {
    solver.logTieAnalysis();
  } else {
    console.log(`${label} failed to generate a solution.`);
  }
}

console.log("\n=== RUNNING RANDOM SELECTION MODE ===");
const solverRandom = new ConstraintSolver();
solverRandom.useNoise = false;
runAndLog(solverRandom, "Random Selection");

console.log("\n=== RUNNING NOISE MODE ===");
const solverNoise = new ConstraintSolver();
solverNoise.useNoise = true;
solverNoise.noiseStrength = 0.2;
runAndLog(solverNoise, "Noise-Based Selection");
