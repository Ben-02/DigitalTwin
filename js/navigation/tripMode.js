import { viewer } from '../map/viewer.js';
import { updatePositionDuringNavigation } from '../map/userLocation.js';

// Navigation state
let isNavigating = false;
let watchId = null;
let routePath = [];
let destinationName = '';
let destinationLat = null;
let destinationLon = null;
let previousLat = null;
let previousLon = null;
let currentHeading = 0;
let offRouteTimer = null;
let smoothLat = null;
let smoothLon = null;

// ===== START NAVIGATION =====
export function startTrip(path, destName, destLat, destLon) {
    if (!path || path.length === 0) {
        alert('No route available. Please search for a building first.');
        return;
    }

    isNavigating = true;
    routePath = path;
    destinationName = destName;
    destinationLat = destLat;
    destinationLon = destLon;
    previousLat = null;
    previousLon = null;
    smoothLat = null;
    smoothLon = null;

    console.log(`🚀 Starting navigation to ${destName}`);

    // Collapse search panel to give more map space
    const content = document.getElementById('ui-content');
    const btn = document.getElementById('toggle-btn');
    if (content) content.style.display = 'none';
    if (btn) btn.textContent = '▲';

    // Show navigation UI
    showNavigationUI();
    updateInstructionBanner('Starting navigation...', '', '#2c3e50');

    // Start watching GPS
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            onPositionUpdate,
            onPositionError,
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 3000 }
        );
    }

    // Initial camera zoom to user
    import('../map/userLocation.js').then(({ userLocation }) => {
        if (userLocation) {
            zoomToUser(userLocation.latitude, userLocation.longitude, 0);
            updateNavigationUI(userLocation.latitude, userLocation.longitude);
        }
    });
}

// ===== STOP NAVIGATION =====
export function stopTrip() {
    isNavigating = false;

    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    if (offRouteTimer) {
        clearTimeout(offRouteTimer);
        offRouteTimer = null;
    }

    // Unlock camera so user can pan freely again
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

    // Hide navigation UI
    hideNavigationUI();

    // Re-expand search panel
    const content = document.getElementById('ui-content');
    const btn = document.getElementById('toggle-btn');
    if (content) content.style.display = 'block';
    if (btn) btn.textContent = '▼';

    console.log('🛑 Navigation stopped');
}

// ===== GPS UPDATE HANDLER =====
function onPositionUpdate(position) {
    if (!isNavigating) return;

    const rawLat = position.coords.latitude;
    const rawLon = position.coords.longitude;

    // Smooth position to reduce GPS jitter
    const { lat, lon } = smoothPosition(rawLat, rawLon);

    // Update heading only if moved 3+ meters
    if (previousLat !== null) {
        const moved = haversineDistance(previousLat, previousLon, lat, lon);
        if (moved > 3) {
            currentHeading = calculateBearing(previousLat, previousLon, lat, lon);
        }
    }

    // Update user marker on map
    updatePositionDuringNavigation(lat, lon);

    // Follow user with camera
    zoomToUser(lat, lon, currentHeading);

    // Update instruction banner and distance bar
    updateNavigationUI(lat, lon);

    // Check if off route
    checkOffRoute(lat, lon);

    // Check if arrived
    const distToDest = haversineDistance(lat, lon, destinationLat, destinationLon);
    if (distToDest < 20) {
        onArrived();
        return;
    }

    previousLat = lat;
    previousLon = lon;
}

function onPositionError(error) {
    console.error('GPS error during navigation:', error.message);
}

// ===== CAMERA FOLLOW =====
function zoomToUser(lat, lon, heading) {
    const position = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
    viewer.camera.lookAt(
        position,
        new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(heading),
            Cesium.Math.toRadians(-50),
            150
        )
    );
}

// ===== GPS SMOOTHING =====
function smoothPosition(lat, lon) {
    if (smoothLat === null) {
        smoothLat = lat;
        smoothLon = lon;
        return { lat, lon };
    }
    smoothLat = lat * 0.7 + smoothLat * 0.3;
    smoothLon = lon * 0.7 + smoothLon * 0.3;
    return { lat: smoothLat, lon: smoothLon };
}

// ===== BEARING CALCULATION =====
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1R = lat1 * Math.PI / 180;
    const lat2R = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2R);
    const x = Math.cos(lat1R) * Math.sin(lat2R) -
               Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// ===== DISTANCE CALCULATION =====
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) ** 2 +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ===== TURN-BY-TURN INSTRUCTIONS =====
function getNextInstruction(userLat, userLon) {
    if (!routePath || routePath.length < 2) {
        return { text: `Head to ${destinationName}`, distance: 0 };
    }

    // Find closest point on route
    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < routePath.length; i++) {
        const d = haversineDistance(userLat, userLon, routePath[i].lat, routePath[i].lon);
        if (d < minDist) { minDist = d; closestIdx = i; }
    }

    // Look ahead for next significant turn
    for (let i = closestIdx + 1; i < routePath.length - 1; i++) {
        const angle = getTurnAngle(
            routePath[i-1].lat, routePath[i-1].lon,
            routePath[i].lat,   routePath[i].lon,
            routePath[i+1].lat, routePath[i+1].lon
        );

        if (Math.abs(angle) > 25) {
            const distToTurn = haversineDistance(userLat, userLon, routePath[i].lat, routePath[i].lon);
            const dir = angle > 0 ? 'right' : 'left';
            const severity = Math.abs(angle) > 70 ? 'Turn' : 'Bear';
            return {
                text: `${severity} ${dir}`,
                distance: Math.round(distToTurn)
            };
        }
    }

    // No turns - head straight to destination
    const distToDest = haversineDistance(userLat, userLon, destinationLat, destinationLon);
    return { text: `Head to ${destinationName}`, distance: Math.round(distToDest) };
}

function getTurnAngle(lat1, lon1, lat2, lon2, lat3, lon3) {
    const b1 = calculateBearing(lat1, lon1, lat2, lon2);
    const b2 = calculateBearing(lat2, lon2, lat3, lon3);
    let angle = b2 - b1;
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;
    return angle;
}

// ===== REMAINING DISTANCE =====
function getRemainingDistance(userLat, userLon) {
    if (!routePath || routePath.length === 0) return 0;

    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < routePath.length; i++) {
        const d = haversineDistance(userLat, userLon, routePath[i].lat, routePath[i].lon);
        if (d < minDist) { minDist = d; closestIdx = i; }
    }

    let remaining = minDist;
    for (let i = closestIdx; i < routePath.length - 1; i++) {
        remaining += haversineDistance(
            routePath[i].lat, routePath[i].lon,
            routePath[i+1].lat, routePath[i+1].lon
        );
    }

    return Math.round(remaining);
}

// ===== OFF ROUTE DETECTION =====
function checkOffRoute(lat, lon) {
    if (!routePath || routePath.length === 0) return;

    let minDist = Infinity;
    for (const point of routePath) {
        const d = haversineDistance(lat, lon, point.lat, point.lon);
        if (d < minDist) minDist = d;
    }

    if (minDist > 35) {
        if (!offRouteTimer) {
            updateInstructionBanner('Recalculating...', '', '#e67e22');
            offRouteTimer = setTimeout(() => {
                if (!isNavigating) return;
                console.log('🔄 Off route - recalculating...');
                import('./pathfinder.js').then(({ drawRouteTo, getCurrentRoutePath }) => {
                    drawRouteTo(destinationLat, destinationLon, destinationName).then(() => {
                        routePath = getCurrentRoutePath();
                    });
                });
                offRouteTimer = null;
            }, 8000);
        }
    } else {
        if (offRouteTimer) {
            clearTimeout(offRouteTimer);
            offRouteTimer = null;
        }
    }
}

// ===== ARRIVAL =====
function onArrived() {
    updateInstructionBanner(`Arrived at ${destinationName}!`, '', '#27ae60');
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    setTimeout(() => {
        stopTrip();
        alert(`✅ You have arrived at ${destinationName}!`);
    }, 2000);
}

// ===== UI UPDATES =====
function updateNavigationUI(userLat, userLon) {
    if (!userLat || !userLon) {
        updateInstructionBanner('Starting navigation...', '', '#2c3e50');
        updateDistanceBar(0, 0);
        return;
    }

    const instruction = getNextInstruction(userLat, userLon);
    const remaining = getRemainingDistance(userLat, userLon);
    const mins = Math.ceil(remaining / 80);

    updateInstructionBanner(
        instruction.text,
        instruction.distance > 0 ? `In ${instruction.distance}m` : ''
    );
    updateDistanceBar(remaining, mins);
}

function updateInstructionBanner(mainText, subText = '', bgColor = '#2c3e50') {
    const banner = document.getElementById('nav-instruction-banner');
    if (!banner) return;
    banner.style.background = bgColor;
    document.getElementById('nav-main-instruction').textContent = mainText;
    const sub = document.getElementById('nav-sub-instruction');
    if (sub) sub.textContent = subText;
}

function updateDistanceBar(remaining, mins) {
    const distEl = document.getElementById('nav-remaining-distance');
    const timeEl = document.getElementById('nav-remaining-time');
    if (distEl) distEl.textContent = remaining >= 1000
        ? `${(remaining/1000).toFixed(1)}km`
        : `${remaining}m`;
    if (timeEl) timeEl.textContent = `~${mins} min${mins !== 1 ? 's' : ''}`;
}

function showNavigationUI() {
    const banner = document.getElementById('nav-instruction-banner');
    const bar = document.getElementById('nav-bottom-bar');
    const infoPanel = document.getElementById('info-panel');
    if (banner) banner.style.display = 'flex';
    if (bar) bar.style.display = 'flex';
    if (infoPanel) infoPanel.style.display = 'none';
}

function hideNavigationUI() {
    const banner = document.getElementById('nav-instruction-banner');
    const bar = document.getElementById('nav-bottom-bar');
    if (banner) banner.style.display = 'none';
    if (bar) bar.style.display = 'none';
}

window.stopTrip = stopTrip;