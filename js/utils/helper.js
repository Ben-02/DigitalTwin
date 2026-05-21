import { CONFIG } from '../config.js';

export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const cosLat = Math.cos((lat1 + lat2) / 2 * toRad);
    return R * Math.sqrt(dLat * dLat + dLon * dLon * cosLat * cosLat);
}

export function isInsideCampus(lat, lon) {
    const coords = CONFIG.CAMPUS_BOUNDARY.coords;
    const vertices = [];
    for (let i = 0; i < coords.length - 2; i += 2) {
        vertices.push([coords[i + 1], coords[i]]);
    }

    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const [yi, xi] = vertices[i];
        const [yj, xj] = vertices[j];
        if (((yi > lat) !== (yj > lat)) &&
            (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}
