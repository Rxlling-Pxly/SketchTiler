import ImageLearner from "./2_components/imageLearner.js";
import ConstraintSolver from "./2_components/constraintSolver.js";

export default class WFCModel {
	imageLearner = new ImageLearner();
	constraintSolver = new ConstraintSolver();

	/**
	 * Learns the patterns of one or more images. Doesn't process images as periodic, and doesn't rotate or reflect patterns.
	 * @param {TilemapImage[]} images The images to learn. If you only want to learn one pass an array with a single image in it.
	 * @param {number} N The width and height of the patterns.
	 * @param {bool} profile Whether to profile the performance of this function or not.
	 */
	learn(images, N, profile) {
		this.imageLearner.learn(images, N, profile);
	}

	/**
	 * Attempts to generate an image based on previously learned pattern data. Returns null if unsuccessful.
	 * @param {number} width The width of the output image.
	 * @param {number} height The height of the output image.
	 * @param {number} maxAttempts
	 * @param {bool} logProgress Whether to log the progress of this function or not.
	 * @param {bool} profile Whether to profile the performance of this function or not.
	 * @returns {TilemapImage | null}
	 */
	generate(width, height, maxAttempts, logProgress, profile) {
		if (!this.imageLearner.patterns) throw new Error("Patterns must be learned before generation");
		const result = this.constraintSolver.solve(this.imageLearner.patterns, this.imageLearner.weights, this.imageLearner.adjacencies, width, height, maxAttempts, logProgress, profile);
		if (result) return this.generateImage();
		else return null;
	}

	/**
	 * Builds and returns an image using the learned patterns and solved wave matrix.
	 * @returns {TilemapImage}
	 */
	generateImage() {
		// Build the image using the top left tile of each cell's pattern.

		const patterns = this.imageLearner.patterns;
		const waveMatrix = this.constraintSolver.waveMatrix;

		const image = [];
		for (let y = 0; y < waveMatrix.length; y++) image[y] = [];

		for (let y = 0; y < waveMatrix.length; y++) {
		for (let x = 0; x < waveMatrix[0].length; x++) {
			const possiblePatterns_Array = waveMatrix[y][x].toArray();
			const i = possiblePatterns_Array[0];	// should be guaranteed to only have 1 possible pattern
			const tileID = patterns[i][0][0];
			image[y][x] = tileID;
		}}

		return image;
	}
}