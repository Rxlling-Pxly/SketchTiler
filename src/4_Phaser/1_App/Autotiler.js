import Phaser from "../../../lib/phaserModule.js";
import TILEMAP from "../3_Utils/tilemap.js";
import WFCModel from "../../2_WFC/1_Model/wfcModel.js";
import IMAGES from "../../2_WFC/2_Input/images.js";
import generateHouse from "../../3_Generators/generateHouse.js";
import generateForest from "../../3_Generators/generateForest.js";
import generateFence from "../../3_Generators/generateFence.js";
import generatePath from "../../3_Generators/generatePath.js";
import generatePaths from "../../3_Generators/generatePaths.js";
import { Regions } from "../../1_Sketchpad/1_Classes/regions.js";
//import { exportSketch } from "../../1_Sketchpad/sketchpad.js";
import generateLayout from "../../3_Generators/generateLayout.js";
import STRUCTURE_TILES from "../3_Utils/structureTiles.js";

// import managers
import StateManager from "./1_Classes/StateManager.js"
import DisplayManager from "./1_Classes/DisplayManager.js"
import RegionManager from "./1_Classes/RegionManager.js"
import LockManager from "./1_Classes/LockManager.js"

//*** MAIN SCENE ***//
export default class Autotiler extends Phaser.Scene {
  constructor() {
    super("autotilerScene")
  }
  
  preload() {
    this.load.setPath("./assets/")
    this.load.image("tilemap", "tinyTown_Tilemap_Packed.png")
    this.load.tilemapTiledJSON("tinyTownMap", "maps/map1.tmj")
    this.load.image("colorTiles", "colorTilemap_Packed.png")
  }
  
  create() {
    this.initializeConfig()
    this.initializeModels()
    this.initializeGenerators()
    this.initializeManagers()
    
    this.setupUIControls()
    this.setupEventListeners()
    
    // hide demo elements
    document.getElementById("wfc-demo").classList.add("hidden")
    document.getElementById("pattern-panel").classList.add("hidden")
  }
  
  initializeConfig() {
    // load tileset info
    const tilesetInfo = TILEMAP["tiny_town"]
    this.height = tilesetInfo.HEIGHT
    this.width = tilesetInfo.WIDTH
    this.tileSize = tilesetInfo.TILE_WIDTH

    // init toggle state
     //this.lockingAll = document.getElementById("structure-lock").checked || false
  }
  
  // makes new manager objects (from classes above)
  initializeManagers() {
    this.state = new StateManager(this.width, this.height)
    this.displayManager = new DisplayManager(this, this.tileSize)
    this.regionManager = new RegionManager(
      this.state, 
      this.tileSize, 
      this.displayManager,
      this.generators
    )
    this.lockHandler = new LockManager(
      this.state,
      this.displayManager,
      this.regionManager
    )

    this.regionManager.lockManager = this.lockHandler
  }
  
  // WFC initialization
  initializeModels() {
    this.groundModel = new WFCModel().learn(IMAGES.GROUND, 2)
    this.structsModel = new WFCModel().learn([...IMAGES.STRUCTURES, ...IMAGES.HOUSES], 2)
    
    this.multiLayerMap = this.add.tilemap("tinyTownMap", this.tileSize, this.tileSize, 40, 25)
    this.tileset = this.multiLayerMap.addTilesetImage("kenney-tiny-town", "tilemap")
  }
  
  // make this.generator object
  initializeGenerators() {
    this.generators = {
      house: (structure) => generateHouse((structure && structure.boundingBox) ? structure.boundingBox : structure),
      path: (structure) => generatePath(structure),
      fence: (structure) => generateFence((structure && structure.boundingBox) ? structure.boundingBox : structure),
      forest: (structure) => generateForest((structure && structure.boundingBox) ? structure.boundingBox : structure)
    }
  }
  
  setupUIControls() {
    // EXPORT
    const exportBtn = document.getElementById("export-map-button")
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.export("map"))
      exportBtn.disabled = true
    }
    
    // OVERLAY TOGGLE
    const overlayToggle = document.getElementById('overlay-toggle');

    overlayToggle.addEventListener("click", () => {
      const showingOverlay = overlayToggle.classList.toggle("active");
      this.displayManager.setLayoutVisibility(showingOverlay);
    });
    
    // STRUCT LOCK TOGGLE
    const lockToggle = document.getElementById("structure-lock")
    if (lockToggle) {
      lockToggle.onclick = () => {
        this.lockingAll = lockToggle.checked
     }
    }
    
    // CANVAS CLICKS
    let ctrl = false;

    this.input.keyboard.on('keydown', (e) => {
      if (e.key === "Control") ctrl = true;
    });

    this.input.keyboard.on('keyup', (e) => {
      if (e.key === "Control") ctrl = false;
    });

    const ctrlKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);

    this.input.on("pointerdown", (pointer) => {
      this.regionManager.handleClick(pointer, ctrlKey.isDown);
    });
  }
  
  // link event listeners to handler functions
  setupEventListeners() {
    window.addEventListener("generate", (e) => this.handleGenerate(e))
    window.addEventListener("clearSketch", (e) => this.handleClearSketch(e))
    window.addEventListener("undoSketch", (e) => this.handleUndoSketch(e))
    window.addEventListener("redoSketch", (e) => this.handleRedoSketch(e))
  }
  
  //*** EVENT HANDLER FUNCTIONS ***/
  // generate button clicked
  handleGenerate(e) {
    // get user regions from sketch
    this.state.userRegions = new Regions(e.detail.sketch, e.detail.structures, this.tileSize).get()
    this.state.layout = null
    
    this.createGroundMap()
    this.state.wfcResult = this.generate(this.state.userRegions)  // WFC
    
    if (this.state.wfcResult) {
      const pathLayer = generatePaths(this.state.wfcResult)
      
      // display layers
      this.displayManager.displayMap('paths', pathLayer, 'tilemap')
      this.displayManager.displayMap('structs', this.state.wfcResult, 'tilemap')
      this.displayManager.displayMap('sketch', this.state.userTiles, 'tilemap', 1, 1)
      this.displayManager.displayMap('locked', this.state.lockedTiles, 'tilemap', 1, 1)

      const overlayToggle = document.getElementById('overlay-toggle');
      const showingOverlay = overlayToggle.classList.contains("active");

      // display layout if it exists and toggle is checked
      if (this.state.layout) {
        this.displayManager.displayMap('layout', this.state.layout.layoutMap, 'colorTiles', 0.25)
        this.displayManager.setLayoutVisibility(showingOverlay);
      }


      // enable map export
      const exportBtn = document.getElementById("export-map-button")
      if (exportBtn) exportBtn.disabled = false
    }

    this.displayManager.showLockRects()
  }
  
  // clear button clicked
  handleClearSketch(e) {
    this.state.userRegions = new Regions(e.detail.sketch, e.detail.structures, this.tileSize).get()
    this.state.resetLockedTiles()
    
    this.displayManager.clearDisplay('paths')
    this.displayManager.clearDisplay('locked')
    this.displayManager.clearDisplay('sketch')
    this.displayManager.clearDisplay('structs')
    this.displayManager.setLayoutVisibility(false)

    this.lockHandler.unlockAll()

    // disable map export
    /*
    const exportBtn = document.getElementById("export-map-button")
    exportBtn.disabled = true
    */
  }
  
  // undo button clicked
  handleUndoSketch(e) {
    // save current (pre-undo) user regions from sketch, then parse new regions
    const previousRegions = this.state.userRegions  
    this.state.userRegions = new Regions(e.detail.sketch, e.detail.structures, this.tileSize).get()
    
    // clear removed regions from phaser canvas
    const removedRegions = this.regionManager.findRemovedRegions(previousRegions, this.state.userRegions)
    for (let region of removedRegions) {
      this.regionManager.clearRegion(region, this.state.lockedTiles)      // unlock any locked tiles in region
      this.regionManager.clearRegion(region, this.state.layout.layoutMap) // remove from layout
      
      if (this.state.lockedRegions[region.type]) {
        // remove from locked regions
        console.log(region)
        const b = { topLeft: region.topLeft, bottomRight: region.bottomRight }
        const i = this.lockHandler.findExistingLock(region.type, b)

        this.lockHandler.unlockStructure(region.type, i, b)

        this.state.lockedRegions[region.type] = this.state.lockedRegions[region.type].filter(
          box => !this.regionManager.regionsMatch(box, region)
         )
        
        // clean up
        if (this.state.lockedRegions[region.type].length === 0) {
          delete this.state.lockedRegions[region.type]
        }
      }
    }
    
    // now display current/updated regions
    this.displayManager.displayMap('sketch', this.state.lockedTiles, 'tilemap', 1, 1)
    this.displayManager.displayMap('layout', this.state.layout.layoutMap, 'colorTiles')

    
    const overlayToggle = document.getElementById('overlay-toggle')
    this.displayManager.setLayoutVisibility(overlayToggle.checked === "true" || false)

    this.displayManager.showLockRects()
  }
  
  // redo button clicked
  handleRedoSketch(e) {
    this.state.userRegions = new Regions(e.detail.sketch, e.detail.structures, this.tileSize).get()
  }
  
  //*** GENERATION ***//
  generate(regions) {
    if (this.state.layout) delete this.state.layout

    // Try standard generation first (all structures together)
    let layout = generateLayout(
      regions,
      "tiny_town",
      "color_blocks",
      2,
      true
    )

    // Fallback: If standard generation failed (likely due to contradiction), try layered generation
    if (!layout) {
      console.warn("Contradiction detected in standard generation. Attempting layered generation...")
      layout = this.generateLayered(regions)
    }

    if (!layout) return null

    this.state.layout = layout
    return this.generateTilemapFromLayout(layout)
  }

  generateLayered(regions) {
    // needsFilter: whether to filter training data for this layer
    const layers = [
      { types: ["fence", "path"], needsFilter: true },
      { types: ["house", "forest"], needsFilter: false },
    ]

    const combinedWorldFacts = []
    const combinedLayoutMap = Array.from({ length: this.height }, () => Array(this.width).fill(0))
    let success = false

    for (const layer of layers) {
      const layerTypes = layer.types

      const layerRegions = {}
      let hasRegions = false

      for (const type in regions) {
        if (layerTypes.includes(type.toLowerCase())) {
          layerRegions[type] = regions[type]
          hasRegions = true
        }
      }

      if (!hasRegions) continue

      // Retry this layer multiple times before giving up
      let layout = null
      const maxLayerAttempts = 3
      for (let attempt = 1; attempt <= maxLayerAttempts; attempt++) {
        layout = generateLayout(
          layerRegions,
          "tiny_town",
          "color_blocks",
          2,
          true,
          layer.needsFilter ? layerTypes : null
        )
        if (layout) break
        console.warn(`Layer [${layerTypes.join(", ")}] attempt ${attempt}/${maxLayerAttempts} failed, retrying...`)
      }

      if (layout) {
        success = true
        const validFacts = layout.worldFacts.filter((fact) =>
          layerTypes.includes(fact.type.toLowerCase())
        )
        combinedWorldFacts.push(...validFacts)
        this.applyLayoutMapOverlay(combinedLayoutMap, layout.layoutMap)
      } else {
        // Fallback: create worldFacts directly from user-drawn regions
        console.warn(`Layer [${layerTypes.join(", ")}] WFC failed, using user regions directly as fallback.`)
        const fallbackFacts = this.createWorldFactsFromRegions(layerRegions)
        if (fallbackFacts.length > 0) {
          success = true
          combinedWorldFacts.push(...fallbackFacts)
          this.paintFactsToLayoutMap(combinedLayoutMap, fallbackFacts)
        }
      }
    }

    if (!success) return null

    return {
      worldFacts: combinedWorldFacts,
      layoutMap: combinedLayoutMap,
    }
  }

  /**
   * Create worldFacts directly from user-drawn regions (fallback when WFC layout generation fails).
   * @param {Record<string, any[]>} regions - User-drawn regions keyed by structure type.
   * @returns {object[]} Array of worldFact objects.
   */
  createWorldFactsFromRegions(regions) {
    const structureDefs = STRUCTURE_TILES["tiny_town"]
    const facts = []

    for (const type in regions) {
      const typeLower = type.toLowerCase()
      const config = structureDefs[typeLower]
      if (!config) continue

      for (const region of regions[type]) {
        if (Array.isArray(region)) {
          if (region.length === 0) continue

          let minX = region[0].x, maxX = region[0].x
          let minY = region[0].y, maxY = region[0].y
          for (const p of region) {
            if (p.x < minX) minX = p.x
            if (p.x > maxX) maxX = p.x
            if (p.y < minY) minY = p.y
            if (p.y > maxY) maxY = p.y
          }

          facts.push({
            type: typeLower,
            boundingBox: {
              topLeft: { x: minX, y: minY },
              width: 1 + maxX - minX,
              height: 1 + maxY - minY,
            },
            color: config.color,
            trace: region,
          })
        } else {
          facts.push({
            type: typeLower,
            boundingBox: {
              topLeft: { x: region.topLeft.x, y: region.topLeft.y },
              width: region.width,
              height: region.height,
            },
            color: config.color,
          })
        }
      }
    }

    return facts
  }
  
  // second, higher-fidelity pass in hierarchical approach 
  generateTilemapFromLayout(layout) {
    let tilemapImage = Array.from({ length: this.height }, () => Array(this.width).fill(-1))

    // Get priority for a structure type (higher number = drawn on top)
    const getPriority = (type) => {
      const info = STRUCTURE_TILES["tiny_town"][type]
      return info && info.priority != null ? info.priority : 0
    }

    // Sort structures: high priority first.
    const sortedFacts = [...layout.worldFacts].sort(
      (a, b) => getPriority(b.type) - getPriority(a.type)
    )

    // Pre-trim regions so lower-priority boxes do not overlap higher-priority boxes.
    const trimmedFacts = this.trimOverlappingFacts(sortedFacts)

    // Ownership map: tracks whether a cell is already claimed by any structure
    const owned = Array.from({ length: this.height }, () => Array(this.width).fill(false))

    for (let structure of trimmedFacts) {
      const region = structure.boundingBox

      // check if region is locked already
      if (this.regionManager.regionOverlap(region, this.state.lockedRegions)) {
        const struct = this.regionManager.getRegionFromMap(region, this.state.lockedTiles)
        this.blitRegionTiles(region, struct, tilemapImage, owned)
        continue
      }

      // Retry individual structure generation up to 3 times
      let gen = null
      const maxRetries = 3
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        gen = this.generateStructureTiles(structure)
        if (gen) break
        console.warn(`Structure ${structure.type} at (${region.topLeft.x}, ${region.topLeft.y}) attempt ${attempt}/${maxRetries} failed, retrying...`)
      }

      if (!gen) {
        console.warn(`Structure generation failed after ${maxRetries} attempts: ${structure.type} at (${region.topLeft.x}, ${region.topLeft.y})`)
        continue
      }

      this.blitRegionTiles(region, gen, tilemapImage, owned)
    }

    return tilemapImage
  }

  generateStructureTiles(structure) {
    const generator = this.generators[structure.type]
    if (!generator) return false
    return generator(structure)
  }

  blitRegionTiles(region, source, dest, owned) {
    for (let y = 0; y < region.height; y++) {
      for (let x = 0; x < region.width; x++) {
        const dy = region.topLeft.y + y
        const dx = region.topLeft.x + x

        if (dy < 0 || dy >= this.height || dx < 0 || dx >= this.width) continue
        if (!source[y] || source[y][x] == null || source[y][x] === -1) continue
        if (owned[dy][dx]) continue

        dest[dy][dx] = source[y][x]
        owned[dy][dx] = true
      }
    }
  }

  applyLayoutMapOverlay(target, overlay) {
    if (!overlay) return
    for (let y = 0; y < Math.min(target.length, overlay.length); y++) {
      for (let x = 0; x < Math.min(target[y].length, overlay[y].length); x++) {
        if (overlay[y][x] > 0) target[y][x] = overlay[y][x]
      }
    }
  }

  paintFactsToLayoutMap(layoutMap, facts) {
    for (const fact of facts) {
      if (fact.trace) {
        for (const p of fact.trace) {
          if (this.inBounds(p.x, p.y)) layoutMap[p.y][p.x] = fact.color
        }
        continue
      }

      const box = fact.boundingBox
      for (let y = box.topLeft.y; y < box.topLeft.y + box.height; y++) {
        for (let x = box.topLeft.x; x < box.topLeft.x + box.width; x++) {
          if (this.inBounds(x, y)) layoutMap[y][x] = fact.color
        }
      }
    }
  }

  trimOverlappingFacts(sortedFacts) {
    const claimed = Array.from({ length: this.height }, () => Array(this.width).fill(false))
    const result = []
    const fenceFacts = sortedFacts.filter((fact) => fact.type === "fence" && fact.boundingBox)

    // Fence acts like a boundary: only its border blocks overlap.
    for (const fence of fenceFacts) {
      this.markFenceBorderClaimed(fence.boundingBox, claimed)
    }

    for (const fact of sortedFacts) {
      const typeInfo = STRUCTURE_TILES["tiny_town"][fact.type]
      const regionType = typeInfo && typeInfo.regionType ? typeInfo.regionType : "box"
      const factCopy = {
        ...fact,
        boundingBox: { ...fact.boundingBox, topLeft: { ...fact.boundingBox.topLeft } }
      }

      if (regionType === "trace") {
        const trimmedTrace = this.trimTraceAgainstClaimed(factCopy.trace || [], claimed)
        if (trimmedTrace.length === 0) continue

        factCopy.trace = trimmedTrace
        const bounds = this.getBoundsFromPoints(trimmedTrace)
        if (!bounds) continue
        factCopy.boundingBox = bounds

        for (const p of trimmedTrace) {
          if (this.inBounds(p.x, p.y)) claimed[p.y][p.x] = true
        }
        result.push(factCopy)
        continue
      }

      // Fence is allowed to overlap (contain) other structures; keep its box intact.
      if (factCopy.type === "fence") {
        result.push(factCopy)
        continue
      }

      const trimmedBox = this.shrinkBoxToAvoidClaimed(factCopy.boundingBox, claimed)
      if (!trimmedBox) continue

      factCopy.boundingBox = trimmedBox
      this.markBoxClaimed(trimmedBox, claimed)
      result.push(factCopy)
    }

    return result
  }

  markFenceBorderClaimed(box, claimed) {
    const left = box.topLeft.x
    const right = box.topLeft.x + box.width - 1
    const top = box.topLeft.y
    const bottom = box.topLeft.y + box.height - 1

    for (let x = left; x <= right; x++) {
      if (this.inBounds(x, top)) claimed[top][x] = true
      if (this.inBounds(x, bottom)) claimed[bottom][x] = true
    }
    for (let y = top; y <= bottom; y++) {
      if (this.inBounds(left, y)) claimed[y][left] = true
      if (this.inBounds(right, y)) claimed[y][right] = true
    }
  }

  trimTraceAgainstClaimed(trace, claimed) {
    return trace.filter(p => this.inBounds(p.x, p.y) && !claimed[p.y][p.x])
  }

  getBoundsFromPoints(points) {
    if (!points || points.length === 0) return null

    let minX = points[0].x, maxX = points[0].x
    let minY = points[0].y, maxY = points[0].y
    for (const p of points) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }

    return {
      topLeft: { x: minX, y: minY },
      width: maxX - minX + 1,
      height: maxY - minY + 1
    }
  }

  markBoxClaimed(box, claimed) {
    for (let y = box.topLeft.y; y < box.topLeft.y + box.height; y++) {
      for (let x = box.topLeft.x; x < box.topLeft.x + box.width; x++) {
        if (this.inBounds(x, y)) claimed[y][x] = true
      }
    }
  }

  hasClaimedOverlap(box, claimed) {
    for (let y = box.topLeft.y; y < box.topLeft.y + box.height; y++) {
      for (let x = box.topLeft.x; x < box.topLeft.x + box.width; x++) {
        if (this.inBounds(x, y) && claimed[y][x]) return true
      }
    }
    return false
  }

  countClaimedOnEdge(box, claimed, edge) {
    let count = 0

    if (edge === "left" || edge === "right") {
      const x = edge === "left" ? box.topLeft.x : box.topLeft.x + box.width - 1
      for (let y = box.topLeft.y; y < box.topLeft.y + box.height; y++) {
        if (this.inBounds(x, y) && claimed[y][x]) count++
      }
      return count
    }

    const y = edge === "top" ? box.topLeft.y : box.topLeft.y + box.height - 1
    for (let x = box.topLeft.x; x < box.topLeft.x + box.width; x++) {
      if (this.inBounds(x, y) && claimed[y][x]) count++
    }
    return count
  }

  shrinkBoxToAvoidClaimed(box, claimed) {
    const current = {
      topLeft: { x: box.topLeft.x, y: box.topLeft.y },
      width: box.width,
      height: box.height
    }

    const clampX0 = Math.max(0, current.topLeft.x)
    const clampY0 = Math.max(0, current.topLeft.y)
    const clampX1 = Math.min(this.width - 1, current.topLeft.x + current.width - 1)
    const clampY1 = Math.min(this.height - 1, current.topLeft.y + current.height - 1)
    current.topLeft.x = clampX0
    current.topLeft.y = clampY0
    current.width = clampX1 - clampX0 + 1
    current.height = clampY1 - clampY0 + 1

    if (current.width <= 0 || current.height <= 0) return null

    const maxSteps = this.width + this.height
    let steps = 0

    while (this.hasClaimedOverlap(current, claimed) && steps < maxSteps) {
      if (current.width <= 1 || current.height <= 1) return null

      const edges = [
        { edge: "left", overlap: this.countClaimedOnEdge(current, claimed, "left") },
        { edge: "right", overlap: this.countClaimedOnEdge(current, claimed, "right") },
        { edge: "top", overlap: this.countClaimedOnEdge(current, claimed, "top") },
        { edge: "bottom", overlap: this.countClaimedOnEdge(current, claimed, "bottom") },
      ]

      edges.sort((a, b) => b.overlap - a.overlap)
      const chosen = edges[0].edge

      if (chosen === "left") {
        current.topLeft.x += 1
        current.width -= 1
      } else if (chosen === "right") {
        current.width -= 1
      } else if (chosen === "top") {
        current.topLeft.y += 1
        current.height -= 1
      } else {
        current.height -= 1
      }

      steps++
    }

    if (current.width <= 0 || current.height <= 0) return null
    return current
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height
  }
  
  // generates background (ground) layer (in one pass, no hierarchical approach here)
  createGroundMap() {
    const image = this.groundModel.generate(this.width, this.height, 10, false, false)
    if (!image) throw new Error("Contradiction created")
    
    if (this.displayManager.displays.ground) {
      // console.log("destroying old ground")
      this.displayManager.displays.ground.map.destroy()
      this.displayManager.displays.ground.layer.destroy()
    }
    
    const groundMap = this.make.tilemap({
      data: image,
      tileWidth: this.tileSize,
      tileHeight: this.tileSize
    })
    const layer = groundMap.createLayer(0, this.tileset, 0, 0)

    this.displayManager.displays.ground = {
      map: groundMap,
      layer: layer
    }
    
    this.state.groundImage = image
  }
  
  //*** EXPORTING ***//
  async export(key) {
    const zip = JSZip()
    
    switch (key) {
      case "map":
        await this.exportMap(zip)
        break
      case "all":
        await this.exportMap(zip)
        await exportSketch(zip)
        break
    }
    
    const blob = await zip.generateAsync({ type: "blob" })
    saveAs(blob, `sketchtiler_export_${key}.zip`)
  }
  
  async exportMap(zip) {
    zip.file("tilemapData.json", JSON.stringify({
      ground: this.convertToSignedArray(this.state.groundImage),
      structures: this.convertToSignedArray(this.state.wfcResult)
    }))
    
    // make it pretty
    this.displayManager.hideLockRects()
    const prevAlpha = {
      structs: this.displayManager.displays.structs.layer.alpha,
      layout: this.displayManager.displays.layout.layer.alpha,
    }
    this.displayManager.displays.structs.layer.setAlpha(1)
    this.displayManager.displays.layout.layer.setAlpha(0)

    await new Promise(resolve => setTimeout(resolve, 10)) // wait a moment (for canvas to reflect changes)
    
    // capture canvas as an image
    const canvas = window.game.canvas
    const dataURL = canvas.toDataURL("image/PNG")
    const base64Data = dataURL.replace(/^data:image\/(png|jpg);base64,/, "")
    
    // download
    zip.file("tilemapImage.png", base64Data, { base64: true })
    
    // only allow exports when something is new 
    const exportBtn = document.getElementById("export-map-button")
    if (exportBtn) exportBtn.disabled = true

    // restore
    this.displayManager.displays.structs.layer.setAlpha(prevAlpha.structs)
    this.displayManager.displays.layout.layer.setAlpha(prevAlpha.layout)
    this.displayManager.showLockRects()
  }
 
  // helper to convert from unsigned to signed
  convertToSignedArray(arr) {
    return arr.map(row => row.map(v => v | 0))
  }
}
