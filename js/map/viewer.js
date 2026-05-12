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
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        infoBox: false,
        selectionIndicator: false,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity
    });

    // Disable expensive visual effects
    viewer.shadows = false;
    viewer.scene.fog.enabled = false;
    viewer.scene.skyAtmosphere.show = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.globe.enableLighting = false;

    // Mobile: slightly reduce resolution
    if (window.innerWidth <= 768) {
        viewer.resolutionScale = 0.85;
    }

    window.viewer = viewer;
    console.log("✅ Cesium viewer initialized");
    return viewer;
}