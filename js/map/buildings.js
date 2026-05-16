import { viewer, scheduleRender } from './viewer.js';
import { CONFIG } from '../config.js';

export let osmBuildings;
export let highlightedFeature = null;

export async function loadOSMBuildings() {
    console.log("🏗️ Loading Cesium OSM Buildings (3D Tiles)...");

    osmBuildings = await Cesium.createOsmBuildingsAsync();

    osmBuildings.maximumScreenSpaceError = 16;

    // Clip buildings outside campus boundary
    const coords = CONFIG.CAMPUS_BOUNDARY.coords;
    osmBuildings.clippingPolygons = new Cesium.ClippingPolygonCollection({
        polygons: [
            new Cesium.ClippingPolygon({
                positions: Cesium.Cartesian3.fromDegreesArray(coords.slice(0, -2))
            })
        ],
        inverse: true
    });

    viewer.scene.primitives.add(osmBuildings);
    scheduleRender(); // ← Tell Cesium to re-render

    console.log("✅ 3D buildings loaded!");
}

export function highlightBuilding(feature) {
    if (highlightedFeature) {
        highlightedFeature.color = Cesium.Color.WHITE;
    }
    
    highlightedFeature = feature;
    feature.color = Cesium.Color.CYAN.withAlpha(0.8);
    scheduleRender(); // ← Re-render after color change
    
    setTimeout(() => {
        if (highlightedFeature === feature) {
            feature.color = Cesium.Color.WHITE;
            highlightedFeature = null;
            scheduleRender(); // ← Re-render after color reset
        }
    }, 3000);
}

export function removeHighlight() {
    if (highlightedFeature) {
        highlightedFeature.color = Cesium.Color.WHITE;
        highlightedFeature = null;
        scheduleRender(); // ← Re-render after removing highlight
    }
}