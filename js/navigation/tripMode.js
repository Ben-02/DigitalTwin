import { viewer, scheduleRender } from '../map/viewer.js';
import { updatePositionDuringNavigation, userLocation } from '../map/userLocation.js';
import { osmBuildings } from '../map/buildings.js';
import { updateRouteDisplay, clearRoute } from './pathfinder.js';

// Navigation state
let isNavigating = false;
let watchId = null;
let routePath = [];
let cumulativeDistances = [];
let destinationName = '';
let destinationLat = null;
let destinationLon = null;
let previousLat = null;
let previousLon = null;
let currentHeading = 0;
let offRouteTimer = null;
let smoothLat = null;
let smoothLon = null;
let lastClosestIdx = 0;
let gpsErrorCount = 0;

// Camera follow state
let isFollowingUser = true;
let userInteracting = false;
let interactionTimer = null;

// Cached DOM elements (set once in startTrip)
let navBanner = null;
let navMainText = null;
let navSubText = null;
let navDistEl = null;
let navTimeEl = null;

// ===== START NAVIGATION =====
export function startTrip(path, destName, destLat, destLon) {
    if (!path || path.length === 0) {
        alert('No route available. Please search for a building first.');
        return;
    }

    isNavigating = true;
    isFollowingUser = true;
    routePath = path;
    buildCumulativeDistances();
    destinationName = destName;
    destinationLat = destLat;
    destinationLon = destLon;
    previousLat = null;
    previousLon = null;
    smoothLat = null;
    smoothLon = null;
    lastClosestIdx = 0;
    gpsErrorCount = 0;

    // Cache DOM elements for frequent updates
    navBanner = document.getElementById('nav-instruction-banner');
    navMainText = document.getElementById('nav-main-instruction');
    navSubText = document.getElementById('nav-sub-instruction');
    navDistEl = document.getElementById('nav-remaining-distance');
    navTimeEl = document.getElementById('nav-remaining-time');

    console.log(`🚀 Starting navigation to ${destName}`);

    // Collapse search panel
    const content = document.getElementById('ui-content');
    const btn = document.getElementById('toggle-btn');
    if (content) content.style.display = 'none';
    if (btn) btn.textContent = '▲';

    // Show navigation UI
    showNavigationUI();
    updateInstructionBanner('Starting navigation...', '', '#2c3e50');

    // Add touch/mouse interaction listeners
    addInteractionListeners();

    // Start watching GPS
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            onPositionUpdate,
            onPositionError,
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 5000 }
        );
    }

    // Initial camera zoom to user
    if (userLocation) {
        zoomToUser(userLocation.latitude, userLocation.longitude, 0);
        updateNavigationUI(userLocation.latitude, userLocation.longitude);
    }
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

    if (interactionTimer) {
        clearTimeout(interactionTimer);
        interactionTimer = null;
    }

    // Remove interaction listeners
    removeInteractionListeners();

    // Remove re-center button
    const recenterBtn = document.getElementById('nav-recenter-btn');
    if (recenterBtn) recenterBtn.remove();

    // Restore tile quality
    if (osmBuildings) {
        osmBuildings.maximumScreenSpaceError = 16;
    }

    // Fly back to overview
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
            previousLon || 115.8945,
            previousLat || -32.0063,
            500
        ),
        orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0
        },
        duration: 1.5
    });

    hideNavigationUI();
    clearRoute(true);
    // Restore normal quality after navigation
    if (osmBuildings) {
        osmBuildings.maximumScreenSpaceError = 16;
    }
    viewer.resolutionScale = window.innerWidth <= 768 ? 0.7 : 1.0;
    scheduleRender();
    // Re-expand search panel
    const content = document.getElementById('ui-content');
    const btn = document.getElementById('toggle-btn');
    if (content) content.style.display = 'block';
    if (btn) btn.textContent = '▼';

    navBanner = null;
    navMainText = null;
    navSubText = null;
    navDistEl = null;
    navTimeEl = null;
    scheduleRender();
    console.log('🛑 Navigation stopped');
}

// ===== INTERACTION DETECTION (Camera Fight Fix) =====
function addInteractionListeners() {
    const canvas = viewer.scene.canvas;
    canvas.addEventListener('pointerdown', onInteractionStart);
    canvas.addEventListener('pointerup', onInteractionEnd);
    canvas.addEventListener('touchstart', onInteractionStart, { passive: true });
    canvas.addEventListener('touchend', onInteractionEnd, { passive: true });
}

function removeInteractionListeners() {
    const canvas = viewer.scene.canvas;
    canvas.removeEventListener('pointerdown', onInteractionStart);
    canvas.removeEventListener('pointerup', onInteractionEnd);
    canvas.removeEventListener('touchstart', onInteractionStart);
    canvas.removeEventListener('touchend', onInteractionEnd);
}

function onInteractionStart() {
    if (!isNavigating) return;
    userInteracting = true;
    isFollowingUser = false;

    // Increase LOD error = lower quality = faster rendering during interaction
    if (osmBuildings) {
        osmBuildings.maximumScreenSpaceError = 64;
        scheduleRender();
    }

    showRecenterButton();

    if (interactionTimer) {
        clearTimeout(interactionTimer);
        interactionTimer = null;
    }
}

function onInteractionEnd() {
    if (!isNavigating) return;

    // Restore quality after 500ms
    if (interactionTimer) clearTimeout(interactionTimer);
    interactionTimer = setTimeout(() => {
        userInteracting = false;
        if (osmBuildings) {
            osmBuildings.maximumScreenSpaceError = 16;
            scheduleRender();
        }
    }, 500);
}

// ===== RE-CENTER BUTTON =====
function showRecenterButton() {
    let btn = document.getElementById('nav-recenter-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'nav-recenter-btn';
        btn.textContent = '⊙ Re-center';
        btn.style.cssText = `
            position: fixed;
            bottom: 90px;
            right: 16px;
            z-index: 3000;
            padding: 10px 16px;
            background: white;
            color: #2c3e50;
            border: 2px solid #2c3e50;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        btn.addEventListener('click', recenterCamera);
        document.body.appendChild(btn);
    }
    btn.style.display = 'block';
}

function hideRecenterButton() {
    const btn = document.getElementById('nav-recenter-btn');
    if (btn) btn.style.display = 'none';
}

function recenterCamera() {
    isFollowingUser = true;
    hideRecenterButton();
    const lat = userLocation ? userLocation.latitude : (previousLat || -32.0063);
    const lon = userLocation ? userLocation.longitude : (previousLon || 115.8945);
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 150),
        orientation: {
            heading: Cesium.Math.toRadians(currentHeading),
            pitch: Cesium.Math.toRadians(-50),
            roll: 0
        },
        duration: 1.0
    });
    if (osmBuildings) {
        osmBuildings.maximumScreenSpaceError = 16;
        scheduleRender();
    }
}

// ===== CLOSEST ROUTE INDEX (computed once per GPS tick) =====
function findClosestRouteIndex(lat, lon) {
    if (!routePath || routePath.length === 0) return { idx: 0, dist: Infinity };

    const WINDOW = 15;
    const start = Math.max(0, lastClosestIdx - WINDOW);
    const end = Math.min(routePath.length, lastClosestIdx + WINDOW);

    let bestIdx = start;
    let bestDist = Infinity;

    for (let i = start; i < end; i++) {
        const d = haversineDistance(lat, lon, routePath[i].lat, routePath[i].lon);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
    }

    // Fallback to full scan if window result seems off-route
    if (bestDist > 50) {
        for (let i = 0; i < routePath.length; i++) {
            const d = haversineDistance(lat, lon, routePath[i].lat, routePath[i].lon);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
    }

    lastClosestIdx = bestIdx;
    return { idx: bestIdx, dist: bestDist };
}

// ===== GPS UPDATE HANDLER =====
function onPositionUpdate(position) {
    if (!isNavigating) return;
    gpsErrorCount = 0;

    const rawLat = position.coords.latitude;
    const rawLon = position.coords.longitude;

    const { lat, lon } = smoothPosition(rawLat, rawLon);

    const moved = previousLat !== null
        ? haversineDistance(previousLat, previousLon, lat, lon)
        : 0;

    if (moved > 3) {
        currentHeading = calculateBearing(previousLat, previousLon, lat, lon);
    }

    updatePositionDuringNavigation(lat, lon);

    // Only follow camera if user hasn't manually interacted
    if ((moved > 5 || previousLat === null) && isFollowingUser) {
        zoomToUser(lat, lon, currentHeading);
    }

    const closest = findClosestRouteIndex(lat, lon);
    updateNavigationUI(lat, lon, closest);
    checkOffRoute(closest.dist);
    updateRouteDisplay(lat, lon, closest.idx);

    const distToDest = haversineDistance(lat, lon, destinationLat, destinationLon);
    if (distToDest < 20) {
        onArrived();
        return;
    }

    previousLat = lat;
    previousLon = lon;
}

function onPositionError(error) {
    if (!isNavigating) return;
    gpsErrorCount++;
    console.error('GPS error during navigation:', error.message);

    if (gpsErrorCount >= 3) {
        updateInstructionBanner('GPS signal lost', 'Check location settings', '#e74c3c');
    } else {
        updateInstructionBanner('Searching for GPS...', '', '#e67e22');
    }
}

// ===== CAMERA FOLLOW =====
function zoomToUser(lat, lon, heading) {
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 150),
        orientation: {
            heading: Cesium.Math.toRadians(heading),
            pitch: Cesium.Math.toRadians(-50),
            roll: 0
        }
    });
    scheduleRender();
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
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const cosLat = Math.cos((lat1 + lat2) / 2 * toRad);
    return R * Math.sqrt(dLat * dLat + dLon * dLon * cosLat * cosLat);
}

// ===== TURN-BY-TURN INSTRUCTIONS =====
function getNextInstruction(userLat, userLon, closestIdx) {
    if (!routePath || routePath.length < 2) {
        return { text: `Head to ${destinationName}`, distance: 0 };
    }

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
            return { text: `${severity} ${dir}`, distance: Math.round(distToTurn) };
        }
    }

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

// ===== CUMULATIVE DISTANCE PRE-COMPUTATION =====
function buildCumulativeDistances() {
    cumulativeDistances = [0];
    for (let i = 0; i < routePath.length - 1; i++) {
        cumulativeDistances.push(
            cumulativeDistances[i] + haversineDistance(
                routePath[i].lat, routePath[i].lon,
                routePath[i+1].lat, routePath[i+1].lon
            )
        );
    }
}

// ===== REMAINING DISTANCE =====
function getRemainingDistance(closestIdx, userLat, userLon) {
    if (!routePath || routePath.length === 0) return 0;

    if (closestIdx < routePath.length - 1) {
        const totalRoute = cumulativeDistances[cumulativeDistances.length - 1];
        const distToClosest = cumulativeDistances[closestIdx];

        // Project user onto current segment for sub-segment accuracy
        const A = routePath[closestIdx];
        const B = routePath[closestIdx + 1];
        const segLen = haversineDistance(A.lat, A.lon, B.lat, B.lon);
        let segProgress = 0;

        if (segLen > 0) {
            const toRad = Math.PI / 180;
            const cosLat = Math.cos((A.lat + B.lat) / 2 * toRad);
            const ax = (userLon - A.lon) * cosLat;
            const ay = userLat - A.lat;
            const bx = (B.lon - A.lon) * cosLat;
            const by = B.lat - A.lat;
            const t = Math.max(0, Math.min(1, (ax * bx + ay * by) / (bx * bx + by * by)));
            segProgress = segLen * t;
        }

        return Math.round(totalRoute - distToClosest - segProgress);
    }

    return Math.round(haversineDistance(userLat, userLon, destinationLat, destinationLon));
}

// ===== OFF ROUTE DETECTION =====
function checkOffRoute(minDist) {
    if (!routePath || routePath.length === 0) return;

    if (minDist > 35) {
        if (!offRouteTimer) {
            updateInstructionBanner('Recalculating...', '', '#e67e22');
            offRouteTimer = setTimeout(() => {
                if (!isNavigating) return;
                import('./pathfinder.js').then(({ drawRouteTo, getCurrentRoutePath }) => {
                    drawRouteTo(destinationLat, destinationLon, destinationName);
                    routePath = getCurrentRoutePath();
                    buildCumulativeDistances();
                    lastClosestIdx = 0;
                });
                offRouteTimer = null;
            }, 4000);
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
    removeInteractionListeners();
    setTimeout(() => {
        stopTrip();
        alert(`✅ You have arrived at ${destinationName}!`);
    }, 2000);
}

// ===== UI UPDATES =====
function updateNavigationUI(userLat, userLon, closest) {
    if (!userLat || !userLon) {
        updateInstructionBanner('Starting navigation...', '', '#2c3e50');
        // Boost performance during navigation
        if (osmBuildings) {
            osmBuildings.maximumScreenSpaceError = 32;
        }
        viewer.resolutionScale = 0.5; // Lower resolution during navigation
        scheduleRender();
        updateDistanceBar(0, 0);
        return;
    }

    if (!closest) {
        closest = findClosestRouteIndex(userLat, userLon);
    }

    const instruction = getNextInstruction(userLat, userLon, closest.idx);
    const remaining = getRemainingDistance(closest.idx, userLat, userLon);
    const mins = Math.ceil(remaining / 80);

    updateInstructionBanner(
        instruction.text,
        instruction.distance > 0 ? `In ${instruction.distance}m` : ''
    );
    updateDistanceBar(remaining, mins);
}

function updateInstructionBanner(mainText, subText = '', bgColor = '#2c3e50') {
    if (!navBanner) return;
    navBanner.style.background = bgColor;
    if (navMainText) navMainText.textContent = mainText;
    if (navSubText) navSubText.textContent = subText;
}

function updateDistanceBar(remaining, mins) {
    if (navDistEl) navDistEl.textContent = remaining >= 1000
        ? `${(remaining/1000).toFixed(1)}km`
        : `${remaining}m`;
    if (navTimeEl) navTimeEl.textContent = `~${mins} min${mins !== 1 ? 's' : ''}`;
}

function showNavigationUI() {
    if (navBanner) navBanner.style.display = 'flex';
    const bar = document.getElementById('nav-bottom-bar');
    if (bar) bar.style.display = 'flex';
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) infoPanel.style.display = 'none';
}

function hideNavigationUI() {
    if (navBanner) navBanner.style.display = 'none';
    const bar = document.getElementById('nav-bottom-bar');
    if (bar) bar.style.display = 'none';
}

window.stopTrip = stopTrip;