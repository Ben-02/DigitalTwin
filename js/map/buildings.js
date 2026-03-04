import { viewer } from './viewer.js';

export let osmBuildings;
export let highlightedFeature = null;

export async function loadOSMBuildings() {
    console.log("🏗️ Loading Cesium OSM Buildings (3D Tiles)...");
    
    osmBuildings = await Cesium.createOsmBuildingsAsync();
    viewer.scene.primitives.add(osmBuildings);
    
    console.log("✅ 3D buildings loaded!");
}

export function highlightBuilding(feature) {
    // Remove previous highlight
    if (highlightedFeature) {
        highlightedFeature.color = Cesium.Color.WHITE;
    }
    
    // Highlight new building
    highlightedFeature = feature;
    feature.color = Cesium.Color.CYAN.withAlpha(0.8);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (highlightedFeature === feature) {
            feature.color = Cesium.Color.WHITE;
            highlightedFeature = null;
        }
    }, 3000);
}

export function removeHighlight() {
    if (highlightedFeature) {
        highlightedFeature.color = Cesium.Color.WHITE;
        highlightedFeature = null;
    }
}