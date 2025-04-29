/*
	Did a lot of AI consulting (ChatGPT and Deepseek) to implement bitmasking for the ImageLearner and ConstraintSolver
	The optimization idea and the writing of the code is credited to them
*/

/** A bitmask that can store more than 32 bits. Can be interfaced with via its methods. */
export default class Bitmask {
	/** Since a single int can only store up to 32 bits (or patterns), use an array of ints to represent a giant int with unlimited size. */
	array;

	/** @param {number} numBits Is equal to the number of patterns. */
	constructor(numBits) {
		const length = Math.ceil(numBits/32);
		this.array = new Uint32Array(length);
	}

	/**
	 * Ex: 4 (decimal) -> 1000 (binary). An array of sub bitmasks forms a complete Bitmask.
	 * @param {number} i 
	 * @returns {number} 
	 */
	static indexToSubBitmask(i) {
		return 1 << i;
	}

	/**
	 * Returns whether b1 === b2.
	 * @param {Bitmask} b1 
	 * @param {Bitmask} b2 
	 * @returns {boolean}
	 */
	static EQUALS(b1, b2) {
		// Compare corresponding elements in the two Bitmasks' arrays
		for (let i = 0; i < b1.array.length; i++) if (b1.array[i] !== b2.array[i]) return false;
		return true;
	}

	/**
	 * Returns a new Bitmask that's the result of b1 & b2.
	 * @param {Bitmask} b1 
	 * @param {Bitmask} b2 
	 * @returns {Bitmask}
	 */
	static AND(b1, b2) {
		const length = b1.array.length * 32;
		const result = new Bitmask(length);
		for (let i = 0; i < b1.array.length; i++) result.array[i] = b1.array[i] & b2.array[i];
		return result;
	}

	/**
	 * Returns a new Bitmask with the same bit values as the source's.
	 * @param {Bitmask} source 
	 * @returns {Bitmask}
	 */
	static createCopy(source) {
		const copy = new Bitmask(0);
		copy.array = source.array.slice();
		return copy;
	}

	/**
	 * Sets the bit at index i to 1.
	 * @param {number} i 
	 */
	setBit(i) {
		const ai = Math.floor(i/32);
		this.array[ai] |= Bitmask.indexToSubBitmask(i);
		return this;	// so the caller can call this function on a new Bitmask in one line (ex: const b = new Bitmask(n).setBit(i))
	}

	/** Sets all bits to 0. */
	clear() {
		this.array.fill(0);
	}

	/**
	 * Returns whether all bits are 0 or not.
	 * @returns {boolean}
	 */
	isEmpty() {
		for (const subBitmask of this.array) if (subBitmask !== 0) return false;
		return true;
	}

	/**
	 * Sets any unset bits in this Bitmask that are set in other.
	 * @param {Bitmask} other 
	 */
	combineWith(other) {
		for (let i = 0; i < this.array.length; i++) this.array[i] |= other.array[i];
	}

	/**
	 * Returns an array of the set bit indices of this Bitmask. Ex: 1010 (binary) -> [1, 3] (decimal).
	 * @returns {number[]}
	 */
	toArray() {
		// Extract all set bits from the Bitmask and push their indices into result
		const result = [];
		for (let i = 0; i < this.array.length; i++) {
			let subBitmask = this.array[i];	// make a copy so we don't alter the actual value
			while (subBitmask !== 0) {
				const lowestSetBit_Signed = subBitmask & -subBitmask;		// ex: 01100 (binary) -> 00100 (binary)
				const lowestSetBit_Unsigned = lowestSetBit_Signed >>> 0;	// necessary if index_Local === 31 (without this you'd get a negative index)
				const base = i*32;
				const index_Local = Math.log2(lowestSetBit_Unsigned)		// ex: 00100 (binary) -> 2 (decimal)
				const index_Final = base + index_Local;
				result.push(index_Final);
				subBitmask ^= lowestSetBit_Unsigned;	// clear the bit
			}
		}
		return result;
	}
}