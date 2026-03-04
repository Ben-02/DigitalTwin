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
            CONFIG.CAMPUS_CENTER.longitude,
            CONFIG.CAMPUS_CENTER.latitude,
            CONFIG.CAMPUS_CENTER.height
        ),
        orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-45),
        },
        duration: 3
    });
}