import { viewer, scheduleRender } from './viewer.js';
import { CONFIG } from '../config.js';

export function drawCampusBoundary() {
    viewer.entities.add({
        name: 'Curtin Bentley Campus',
        polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(CONFIG.CAMPUS_BOUNDARY.coords),
            width: 6,
            material: Cesium.Color.ORANGE,
            clampToGround: true
        }
    });
    
    scheduleRender();
}