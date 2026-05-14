import { CONFIG } from '../config.js';

export let viewer;

let renderQueued = false;
export function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
        renderQueued = false;
        if (viewer) viewer.scene.requestRender();
    });
}

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

    // Mobile: reduce resolution for better performance
    if (window.innerWidth <= 768) {
        viewer.resolutionScale = 0.7; // Better performance on mobile
    }

    // Increase tile cache - keeps more tiles in memory during navigation
    viewer.scene.globe.tileCacheSize = 500;

    // Start camera at campus so there's no globe-spinning on load
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(115.8924, -32.0205, 3150),
        orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-60),
            roll: 0
        }
    });
}