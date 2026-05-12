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

        // ===== PERFORMANCE SETTINGS =====
        requestRenderMode: true,          // Only render when something changes
        maximumRenderTimeChange: Infinity  // Don't force re-renders
    });

    // Disable expensive visual effects
    viewer.shadows = false;
    viewer.scene.fog.enabled = false;
    viewer.scene.skyAtmosphere.show = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.globe.enableLighting = false;

    // Mobile: slightly reduce resolution for better performance
    if (window.innerWidth <= 768) {
        viewer.resolutionScale = 0.85;
    }

    // Make viewer accessible globally for debugging
    window.viewer = viewer;
    
    console.log("✅ Cesium viewer initialized");
    return viewer;
}