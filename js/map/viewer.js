import { CONFIG } from '../config.js';

export let viewer;

export function initializeViewer() {
    Cesium.Ion.defaultAccessToken = CONFIG.CESIUM_TOKEN;
    
    viewer = new Cesium.Viewer('cesiumContainer', {
        terrain: Cesium.Terrain.fromWorldTerrain(),
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: true,
        sceneModePicker: false,
        navigationHelpButton: true,
        infoBox: false,
        selectionIndicator: false
    });
    
    console.log("✅ Cesium viewer initialized");
    
    return viewer;
}