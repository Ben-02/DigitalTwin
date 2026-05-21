export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const cosLat = Math.cos((lat1 + lat2) / 2 * toRad);
    return R * Math.sqrt(dLat * dLat + dLon * dLon * cosLat * cosLat);
}
