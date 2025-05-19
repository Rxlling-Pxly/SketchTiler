/*
	Create global type definitions to be used by other project files here
	These typedefs simply exist to improve code readability and editor support, especially for JSDoc comments
	
	See jsconfigExplained.txt for more information about this file
*/

// Imports (for the following typedefs to use)
/**
 * @typedef {import("../2_WFC/1_Model/Bitmask.js").default} Bitmask
 */

// Sketchpad
/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ x: number, y: number }} CanvasPoint A point with canvas coordinates. That means x and y represent a pixel's location.
 * @typedef {{ x: number, y: number }} TilemapPoint A point with tilemap coordinates. That means x and y represent a tile's location.
 * @typedef {{ topLeft: Point, bottomRight: Point, width: number, height: number }} BoundingBox Note that the two points are in tilemap coordinates.
 */

// WFC
/**
 * @typedef {number[]} Direction An array of two numbers. The first stores y and the second stores x. Positive y points down while positive x points right.
 * 
 * @typedef {number[][]} TilemapImage A 2D matrix of tile IDs that represents a layer of a tilemap.
 * 
 * @typedef {number[][]} Pattern A 2D NxN matrix of tile IDs.
 *
 * @typedef {Bitmask} TilePatternsBitmask Given a tile A, stores which patterns contain A as their top left tile.
 * @typedef {[y: number, x: number, tilePatternsBitmask: TilePatternsBitmask]} SetTileInstruction
 * 
 * @typedef {Bitmask} AdjacentPatternsBitmask Given a pattern A, stores which patterns are adjacent to A in a single direction.
 * @typedef {AdjacentPatternsBitmask[]} AdjacentPatternsMap An array of four AdjacentPatternsBitmasks. Given a pattern A, stores which patterns are adjacent to A in each of the four directions (in order of up, down, left, right).
 * 
 * @typedef {Bitmask} PossiblePatternsBitmask Stores which patterns a cell can become.
 * 
 * @typedef {PossiblePatternsBitmask} Cell Currently the only info a cell needs to contain is its PossiblePatternsBitmask so for simplicity it is just that instead of an object containing it.
 */