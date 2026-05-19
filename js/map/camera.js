import { viewer } from './viewer.js';
import { CONFIG } from '../config.js';

export function flyToBuilding(lat, lon, buildingHeight = 10) {
    const targetPosition = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
    
    const boundingSphere = new Cesium.BoundingSphere(
        targetPosition,
        buildingHeight / 2
    );
    
    const offset = new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(CONFIG.CAMERA.DEFAULT_HEADING),
        Cesium.Math.toRadians(CONFIG.CAMERA.DEFAULT_PITCH),
        CONFIG.CAMERA.DEFAULT_DISTANCE
    );
    
    viewer.camera.flyToBoundingSphere(boundingSphere, {
        duration: 2.0,
        offset: offset
    });
}

export function flyToCampus() {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
            115.8924,   // Slightly west to center campus
            -32.0215,   // Campus center latitude
            3400        // Higher altitude to see full campus
        ),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-60), // More top-down
            roll: 0
        },
        duration: 3
    });
}

window.resetCampusView = function() { flyToCampus(); };

