import { viewer, scheduleRender } from '../map/viewer.js';
import { updatePositionDuringNavigation, userLocation } from '../map/userLocation.js';
import { osmBuildings } from '../map/buildings.js';
import { updateRouteDisplay, clearRoute, setNavigationActive, removeStartPin } from './pathfinder.js';
import { calculateDistance } from '../utils/helper.js';
import { CONFIG } from '../config.js';


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


let isFollowingUser = true;
let userInteracting = false;
let interactionTimer = null;

let deviceHeading = null;
let compassListener = null;

let navBanner = null;
let navMainText = null;
let navSubText = null;
let navDistEl = null;
let navTimeEl = null;

export function startTrip(path, destName, destLat, destLon) {
    if (!path || path.length === 0) {
        alert('No route available. Please search for a building first.');
        return;
    }

    isNavigating = true;
    setNavigationActive(true);
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

    navBanner = document.getElementById('nav-instruction-banner');
    navMainText = document.getElementById('nav-main-instruction');
    navSubText = document.getElementById('nav-sub-instruction');
    navDistEl = document.getElementById('nav-remaining-distance');
    navTimeEl = document.getElementById('nav-remaining-time');

    const overlay = document.getElementById('ui-overlay');
    if (overlay) overlay.style.display = 'none';
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) helpBtn.style.display = 'none';

    startCompass();
    removeStartPin();
    showNavigationUI();
    updateInstructionBanner('Starting navigation...', '', '#2c3e50');

    addInteractionListeners();

    const startGPSWatch = () => {
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                onPositionUpdate,
                onPositionError,
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 5000 }
            );
        }
    };

    if (userLocation) {
        const target = Cesium.Cartesian3.fromDegrees(userLocation.longitude, userLocation.latitude, 0);
        viewer.camera.flyToBoundingSphere(
            new Cesium.BoundingSphere(target, 0),
            {
                offset: new Cesium.HeadingPitchRange(
                    Cesium.Math.toRadians(deviceHeading !== null ? deviceHeading : 0),
                    Cesium.Math.toRadians(-50),
                    150
                ),
                duration: 1.5,
                complete: startGPSWatch,
                cancel: startGPSWatch
            }
        );
        updateNavigationUI(userLocation.latitude, userLocation.longitude);
    } else {
        startGPSWatch();
    }
}

export function stopTrip() {
    isNavigating = false;
    setNavigationActive(false);

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

    removeInteractionListeners();
    stopCompass();

    const recenterBtn = document.getElementById('nav-recenter-btn');
    if (recenterBtn) recenterBtn.remove();

    if (osmBuildings) {
        osmBuildings.maximumScreenSpaceError = 16;
    }

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
    if (osmBuildings) {
        osmBuildings.maximumScreenSpaceError = 16;
    }
    viewer.resolutionScale = window.innerWidth <= 768 ? 0.7 : 1.0;
    scheduleRender();
    const overlay = document.getElementById('ui-overlay');
    if (overlay) overlay.style.display = '';
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) helpBtn.style.display = '';
    const content = document.getElementById('ui-content');
    const toggleBtn = document.getElementById('toggle-btn');
    if (content) content.style.display = 'block';
    if (toggleBtn) toggleBtn.textContent = '▼';

    navBanner = null;
    navMainText = null;
    navSubText = null;
    navDistEl = null;
    navTimeEl = null;
    scheduleRender();
}

function startCompass() {
    const handler = (event) => {
        if (event.webkitCompassHeading !== undefined) {
            deviceHeading = event.webkitCompassHeading;
        } else if (event.alpha !== null) {
            deviceHeading = (360 - event.alpha) % 360;
        }
    };

    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handler);
                    compassListener = handler;
                }
            })
            .catch(() => {});
    } else {
        window.addEventListener('deviceorientation', handler);
        compassListener = handler;
    }
}

function stopCompass() {
    if (compassListener) {
        window.removeEventListener('deviceorientation', compassListener);
        compassListener = null;
    }
    deviceHeading = null;
}

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

    if (interactionTimer) clearTimeout(interactionTimer);
    interactionTimer = setTimeout(() => {
        userInteracting = false;
        if (osmBuildings) {
            osmBuildings.maximumScreenSpaceError = 16;
            scheduleRender();
        }
    }, 500);
}

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
    const target = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
    viewer.camera.flyToBoundingSphere(
        new Cesium.BoundingSphere(target, 0),
        {
            offset: new Cesium.HeadingPitchRange(
                Cesium.Math.toRadians(currentHeading),
                Cesium.Math.toRadians(-50),
                150
            ),
            duration: 1.0
        }
    );
    if (osmBuildings) {
        osmBuildings.maximumScreenSpaceError = 16;
        scheduleRender();
    }
}

function findClosestRouteIndex(lat, lon) {
    if (!routePath || routePath.length === 0) return { idx: 0, dist: Infinity };

    const start = Math.max(0, lastClosestIdx - CONFIG.NAVIGATION.ROUTE_SEARCH_WINDOW);
    const end = Math.min(routePath.length, lastClosestIdx + CONFIG.NAVIGATION.ROUTE_SEARCH_WINDOW);

    let bestIdx = start;
    let bestDist = Infinity;

    for (let i = start; i < end; i++) {
        const d = calculateDistance(lat, lon, routePath[i].lat, routePath[i].lon);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
    }

    if (bestDist > CONFIG.NAVIGATION.FULL_SCAN_THRESHOLD) {
        for (let i = 0; i < routePath.length; i++) {
            const d = calculateDistance(lat, lon, routePath[i].lat, routePath[i].lon);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
    }

    lastClosestIdx = bestIdx;
    return { idx: bestIdx, dist: bestDist };
}

function onPositionUpdate(position) {
    if (!isNavigating) return;
    gpsErrorCount = 0;

    const rawLat = position.coords.latitude;
    const rawLon = position.coords.longitude;

    const { lat, lon } = smoothPosition(rawLat, rawLon);

    const moved = previousLat !== null
        ? calculateDistance(previousLat, previousLon, lat, lon)
        : 0;

    if (deviceHeading !== null) {
        currentHeading = deviceHeading;
    } else if (moved > CONFIG.NAVIGATION.HEADING_MOVE_THRESHOLD) {
        currentHeading = calculateBearing(previousLat, previousLon, lat, lon);
    }

    updatePositionDuringNavigation(lat, lon);

    if ((moved > CONFIG.NAVIGATION.CAMERA_FOLLOW_THRESHOLD || previousLat === null) && isFollowingUser) {
        zoomToUser(lat, lon, currentHeading);
    }

    const closest = findClosestRouteIndex(lat, lon);
    updateNavigationUI(lat, lon, closest);
    checkOffRoute(closest.dist);
    updateRouteDisplay(lat, lon, closest.idx);

    const distToDest = calculateDistance(lat, lon, destinationLat, destinationLon);
    if (distToDest < CONFIG.NAVIGATION.ARRIVAL_THRESHOLD) {
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

    if (gpsErrorCount >= CONFIG.NAVIGATION.GPS_ERROR_LIMIT) {
        updateInstructionBanner('GPS signal lost', 'Check location settings', '#e74c3c');
    } else {
        updateInstructionBanner('Searching for GPS...', '', '#e67e22');
    }
}

function zoomToUser(lat, lon, heading) {
    const target = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
    viewer.camera.lookAt(target, new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(heading),
        Cesium.Math.toRadians(-50),
        150
    ));
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    scheduleRender();
}

function smoothPosition(lat, lon) {
    if (smoothLat === null) {
        smoothLat = lat;
        smoothLon = lon;
        return { lat, lon };
    }
    const alpha = CONFIG.NAVIGATION.GPS_SMOOTHING_FACTOR;
    smoothLat = lat * alpha + smoothLat * (1 - alpha);
    smoothLon = lon * alpha + smoothLon * (1 - alpha);
    return { lat: smoothLat, lon: smoothLon };
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1R = lat1 * Math.PI / 180;
    const lat2R = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2R);
    const x = Math.cos(lat1R) * Math.sin(lat2R) -
               Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

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

        if (Math.abs(angle) > CONFIG.NAVIGATION.TURN_ANGLE_THRESHOLD) {
            const distToTurn = calculateDistance(userLat, userLon, routePath[i].lat, routePath[i].lon);
            const dir = angle > 0 ? 'right' : 'left';
            const severity = Math.abs(angle) > CONFIG.NAVIGATION.SHARP_TURN_THRESHOLD ? 'Turn' : 'Bear';
            return { text: `${severity} ${dir}`, distance: Math.round(distToTurn) };
        }
    }

    const distToDest = calculateDistance(userLat, userLon, destinationLat, destinationLon);
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

function buildCumulativeDistances() {
    cumulativeDistances = [0];
    for (let i = 0; i < routePath.length - 1; i++) {
        cumulativeDistances.push(
            cumulativeDistances[i] + calculateDistance(
                routePath[i].lat, routePath[i].lon,
                routePath[i+1].lat, routePath[i+1].lon
            )
        );
    }
}

function getRemainingDistance(closestIdx, userLat, userLon) {
    if (!routePath || routePath.length === 0) return 0;

    if (closestIdx < routePath.length - 1) {
        const totalRoute = cumulativeDistances[cumulativeDistances.length - 1];
        const distToClosest = cumulativeDistances[closestIdx];

        const A = routePath[closestIdx];
        const B = routePath[closestIdx + 1];
        const segLen = calculateDistance(A.lat, A.lon, B.lat, B.lon);
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

    return Math.round(calculateDistance(userLat, userLon, destinationLat, destinationLon));
}

function checkOffRoute(minDist) {
    if (!routePath || routePath.length === 0) return;

    if (minDist > CONFIG.NAVIGATION.OFF_ROUTE_THRESHOLD) {
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
            }, CONFIG.NAVIGATION.OFF_ROUTE_DELAY);
        }
    } else {
        if (offRouteTimer) {
            clearTimeout(offRouteTimer);
            offRouteTimer = null;
        }
    }
}

function onArrived() {
    updateInstructionBanner(`Arrived at ${destinationName}!`, '', '#27ae60');
    removeInteractionListeners();
    setTimeout(() => {
        stopTrip();
        alert(`✅ You have arrived at ${destinationName}!`);
    }, 2000);
}

function updateNavigationUI(userLat, userLon, closest) {
    if (!userLat || !userLon) {
        updateInstructionBanner('Starting navigation...', '', '#2c3e50');
        if (osmBuildings) {
            osmBuildings.maximumScreenSpaceError = 32;
        }
        viewer.resolutionScale = 0.5;
        scheduleRender();
        updateDistanceBar(0, 0);
        return;
    }

    if (!closest) {
        closest = findClosestRouteIndex(userLat, userLon);
    }

    const instruction = getNextInstruction(userLat, userLon, closest.idx);
    const remaining = getRemainingDistance(closest.idx, userLat, userLon);
    const mins = Math.ceil(remaining / CONFIG.NAVIGATION.WALKING_SPEED);

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