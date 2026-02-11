# WFC Contradiction Fix Walkthrough

I have addressed the issue where "User's set tiles formed a contradiction" would occur when placing structures inside or adjacent to others (e.g., a "donut" shape).

## Changes

### 1. Synthetic Training Data Generation
I modified `generateLayout.js` to include a new function `generateAugmentedLayouts()`. This function creates small, synthetic map layouts that explicitly demonstrate every pairing of structure types (House, Fence, Forest) in various configurations:
- **Nested**: One structure inside another.
- **Adjacent**: Two structures touching side-by-side.
- **Overlapping**: Two structures intersecting.
- **Hole**: A structure with an empty void inside.

These synthetic layouts are added to the training set in `learnLayout`, ensuring the WFC model learns that these transitions are valid.

## Verification

To verify the fix:
1.  **Launch the Application**: Run the SketchTiler application.
2.  **Draw a Nested Structure**: 
    -   Select "Fence" and draw a large box.
    -   Select "House" and draw a smaller box *inside* the fence.
3.  **Generate**: Click the "Generate" button.
4.  **Observe**: The generation should complete successfully without the "contradiction" error, and you should see the house correctly placed inside the fence in the generated map.

## Technical Details
-   **File Modified**: `src/3_Generators/generateLayout.js`
-   **New Functions**: `generateAugmentedLayouts`, `drawStructure`
-   **Logic**: The system now iterates through all defined structure types in `colortiles` and generates valid adjacency patterns for the WFC solver, effectively relaxing the constraints that previously forbade nesting.

---

# Nested Structure Overwrite Fix Walkthrough

I have also addressed the issue where inner structures (like a House inside a Fence) would disappear because the outer structure (Fence) was drawn on top of them.

## Changes

### 1. Rendering Order Sorting (Painter's Algorithm)
I modified `Autotiler.js` to sort the structures before generating them on the map. The sorting logic is:
1.  **Priority Ascending**: Lower priority items (e.g., Forest, Priority 1) are drawn first, forming the background. Higher priority items (e.g., House/Fence, Priority 3) are drawn later.
2.  **Area Descending**: If priorities are equal, Larger structures are drawn before Smaller structures. This ensures that a large Fence is drawn first, and the small House inside it is drawn on top, preserving the House.

## Verification

To verify the fix:
1.  **Launch the Application**: Run the SketchTiler application.
2.  **Draw a Nested Structure**: 
    -   Select "Fence" and draw a large box.
    -   Select "House" and draw a smaller box *inside* the fence.
3.  **Generate**: Click the "Generate" button.
4.  **Observe**: 
    -   The House should be visible inside the Fence.
    -   Previously, only the Fence would be visible.
5.  **Test Priority**:
    -   Draw a House inside a Forest.
    -   Forest is Priority 1, House is Priority 3.
    -   Forest should be drawn first (background), House second (foreground).
    -   Result: House should be visible on top of Forest.

## Technical Details
-   **File Modified**: `src/4_Phaser/Autotiler.js`
-   **Logic**: Added a `sort` function to `layout.worldFacts` in `generateTilemapFromLayout`.
