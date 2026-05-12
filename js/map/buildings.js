import { viewer } from './viewer.js';

export let osmBuildings;
export let highlightedFeature = null;

export async function loadOSMBuildings() {
    console.log("🏗️ Loading Cesium OSM Buildings (3D Tiles)...");
    
    osmBuildings = await Cesium.createOsmBuildingsAsync();
    
    // Optimize tileset performance
    osmBuildings.maximumScreenSpaceError = 16; // Default is 16, increase for better performance
    
    viewer.scene.primitives.add(osmBuildings);
    viewer.scene.requestRender(); // ← Tell Cesium to re-render
    
    console.log("✅ 3D buildings loaded!");
}

export function highlightBuilding(feature) {
    if (highlightedFeature) {
        highlightedFeature.color = Cesium.Color.WHITE;
    }
    
    highlightedFeature = feature;
    feature.color = Cesium.Color.CYAN.withAlpha(0.8);
    viewer.scene.requestRender(); // ← Re-render after color change
    
    setTimeout(() => {
        if (highlightedFeature === feature) {
            feature.color = Cesium.Color.WHITE;
            highlightedFeature = null;
            viewer.scene.requestRender(); // ← Re-render after color reset
        }
    }, 3000);
}

export function removeHighlight() {
    if (highlightedFeature) {
        highlightedFeature.color = Cesium.Color.WHITE;
        highlightedFeature = null;
        viewer.scene.requestRender(); // ← Re-render after removing highlight
    }
}