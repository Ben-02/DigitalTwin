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

    // Lock camera to Curtin Bentley campus
    const campusBounds = {
        minLon: Cesium.Math.toRadians(115.878),
        maxLon: Cesium.Math.toRadians(115.908),
        minLat: Cesium.Math.toRadians(-33.019),
        maxLat: Cesium.Math.toRadians(-31.993),
        minHeight: 50,
        maxHeight: 3150
    };

    // ✅ preUpdate - intercepts BEFORE render (no jitter!)
    viewer.scene.preUpdate.addEventListener(() => {
        const pos = viewer.camera.positionCartographic;
        if (!pos) return;

        let outOfBounds = false;

        let lon = pos.longitude;
        if (lon < campusBounds.minLon) { lon = campusBounds.minLon; outOfBounds = true; }
        if (lon > campusBounds.maxLon) { lon = campusBounds.maxLon; outOfBounds = true; }

        let lat = pos.latitude;
        if (lat < campusBounds.minLat) { lat = campusBounds.minLat; outOfBounds = true; }
        if (lat > campusBounds.maxLat) { lat = campusBounds.maxLat; outOfBounds = true; }

        let height = pos.height;
        if (height < campusBounds.minHeight) { height = campusBounds.minHeight; outOfBounds = true; }
        if (height > campusBounds.maxHeight) { height = campusBounds.maxHeight; outOfBounds = true; }

        if (outOfBounds) {
            viewer.camera.position = Cesium.Cartesian3.fromRadians(lon, lat, height);
        }
    });

    return viewer;
}