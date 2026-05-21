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

    // CesiumJS default scroll zoom is too aggressive
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

    viewer.shadows = false;
    viewer.scene.fog.enabled = false;
    viewer.scene.skyAtmosphere.show = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.globe.enableLighting = false;

    if (window.innerWidth <= 768) {
        viewer.resolutionScale = 0.7;
    }

    viewer.scene.globe.tileCacheSize = 500;

    viewer.scene.globe.cartographicLimitRectangle = Cesium.Rectangle.fromDegrees(
        CONFIG.CAMPUS_BOUNDARY.coords[0],
        CONFIG.CAMPUS_BOUNDARY.coords[7],
        CONFIG.CAMPUS_BOUNDARY.coords[2],
        CONFIG.CAMPUS_BOUNDARY.coords[1]
    );

    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(115.8924, -32.0215, 3400),
        orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-60),
            roll: 0
        }
    });
}