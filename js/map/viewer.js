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

    // Custom scroll-wheel zoom — CesiumJS default is too aggressive
    const controller = viewer.scene.screenSpaceCameraController;
    controller.zoomEventTypes = [Cesium.CameraEventType.RIGHT_DRAG, Cesium.CameraEventType.PINCH];
    viewer.scene.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const height = viewer.camera.positionCartographic.height;
        const amount = height * 0.15;
        if (e.deltaY > 0) viewer.camera.zoomOut(amount);
        else viewer.camera.zoomIn(amount);
        scheduleRender();
    }, { passive: false });

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

    // Only load terrain/imagery within the campus boundary
    viewer.scene.globe.cartographicLimitRectangle = Cesium.Rectangle.fromDegrees(
        CONFIG.CAMPUS_BOUNDARY.coords[0],   // west
        CONFIG.CAMPUS_BOUNDARY.coords[7],   // south
        CONFIG.CAMPUS_BOUNDARY.coords[2],   // east
        CONFIG.CAMPUS_BOUNDARY.coords[1]    // north
    );

    // Start camera at campus so there's no globe-spinning on load
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(115.8924, -32.0215, 3400),
        orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-60),
            roll: 0
        }
    });
}