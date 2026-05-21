import { viewer, scheduleRender } from '../map/viewer.js';
import { userLocation } from '../map/userLocation.js';
import { setLastDestination, clearLastDestination } from '../map/userLocation.js';
import { findNearestNode, findPath, getNodeById } from './pathGraph.js';
import { calculateDistance } from '../utils/helper.js';
import { CONFIG } from '../config.js';

let currentRoutePath = [];
let currentDestination = { lat: null, lon: null, name: null };
let customStartPoint = null;
let navigationActive = false;
let startPin = null;
let endPin = null;
const pinBuilder = new Cesium.PinBuilder();

export function setNavigationActive(active) { navigationActive = active; }

export function getCurrentRoutePath() { return currentRoutePath; }
export function getCurrentDestination() { return currentDestination; }

export function setCustomStartPoint(lat, lon, name) {
    if (currentRoute) {
        viewer.entities.remove(currentRoute);
        currentRoute = null;
        removeRoutePins();
        clearLastDestination();
        hideEndBanner();
        currentRoutePath = [];
        currentDestination = { lat: null, lon: null, name: null };
        document.getElementById('info-panel').style.display = 'none';
        scheduleRender();
    }
    customStartPoint = { latitude: lat, longitude: lon, name };
    console.log(`📌 Custom start set: ${name}`);
    showStartBanner(name);
}

export function clearCustomStartPoint(skipConfirm = false) {
    if (!skipConfirm && currentRoute) {
        const confirmed = confirm('Clear the start point? You can re-select a new starting point.');
        if (!confirmed) return;
    }

    const savedDest = currentDestination.lat ? { ...currentDestination } : null;
    const showReselect = !skipConfirm && savedDest;

    customStartPoint = null;
    hideStartBanner();

    if (currentRoute) {
        viewer.entities.remove(currentRoute);
        currentRoute = null;
        removeRoutePins();
        clearLastDestination();
        hideEndBanner();
        currentRoutePath = [];
        currentDestination = { lat: null, lon: null, name: null };
        scheduleRender();
    }

    if (showReselect) {
        import('../ui/infoPanel.js').then(({ showStartReselect }) => {
            showStartReselect(savedDest.lat, savedDest.lon, savedDest.name);
        });
    } else if (!skipConfirm) {
        document.getElementById('info-panel').style.display = 'none';
        expandSearchPanel();
    }
    console.log("🗑️ Custom start cleared");
}

export function getCustomStartPoint() {
    return customStartPoint;
}

export function hasActiveRoute() {
    return currentRoute !== null;
}

let currentRoute = null;

function addRoutePins(startLat, startLon, endLat, endLon) {
    removeRoutePins();

    startPin = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(startLon, startLat, 0),
        billboard: {
            image: pinBuilder.fromText('S', Cesium.Color.GREEN, 48).toDataURL(),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
    });

    endPin = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(endLon, endLat, 0),
        billboard: {
            image: pinBuilder.fromText('E', Cesium.Color.RED, 48).toDataURL(),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
    });
}

function removeRoutePins() {
    if (startPin) { viewer.entities.remove(startPin); startPin = null; }
    if (endPin) { viewer.entities.remove(endPin); endPin = null; }
}

function zoomToShowRoute(startLat, startLon, targetLat, targetLon) {
    const positions = [
        Cesium.Cartesian3.fromDegrees(startLon, startLat, 0),
        Cesium.Cartesian3.fromDegrees(targetLon, targetLat, 0)
    ];
    
    const boundingSphere = Cesium.BoundingSphere.fromPoints(positions);
    boundingSphere.radius = boundingSphere.radius * 1.0;
    
    viewer.camera.flyToBoundingSphere(boundingSphere, {
        duration: 2.5,
        offset: new Cesium.HeadingPitchRange(
            0,
            Cesium.Math.toRadians(-35),
            0
        )
    });
    
    console.log("📷 Camera adjusted to show full route");
}

export function drawRouteTo(targetLat, targetLon, targetName = "Destination") {
    console.log(`🗺️ Drawing route to ${targetName}...`);

    const startPoint = customStartPoint || userLocation;
    if (!startPoint) {
        alert("Cannot find route - location not available");
        return;
    }
    const usingCustomStart = customStartPoint !== null;

    if (!usingCustomStart) {
        setLastDestination(targetLat, targetLon, targetName);
    }

    if (currentRoute) {
        viewer.entities.remove(currentRoute);
    }
    removeRoutePins();

    const startResult = findNearestNode(startPoint.latitude, startPoint.longitude);
    const endResult = findNearestNode(targetLat, targetLon);
    
    if (!startResult || !endResult) {
        console.error("Could not find pathway nodes");
        return;
    }
    
    console.log(`Start node: ${startResult.distance.toFixed(1)}m away`);
    console.log(`End node: ${endResult.distance.toFixed(1)}m away`);
    
    const path = findPath(startResult.node, endResult.node);
    
    if (!path) {
        alert("Could not find a route. Using direct path.");
        drawDirectRoute(targetLat, targetLon, targetName);
        return;
    }
    
    const pathCoordinates = [];
    pathCoordinates.push(startPoint.longitude, startPoint.latitude);
    path.forEach(nodeId => {
        const node = getNodeById(nodeId);
        if (node) {
            pathCoordinates.push(node.longitude, node.latitude);
        }
    });
    pathCoordinates.push(targetLon, targetLat);

    currentRoutePath = [];
    currentRoutePath.push({ lat: startPoint.latitude, lon: startPoint.longitude });
    path.forEach(nodeId => {
        const node = getNodeById(nodeId);
        if (node) currentRoutePath.push({ lat: node.latitude, lon: node.longitude });
    });
    currentRoutePath.push({ lat: targetLat, lon: targetLon });
    currentDestination = { lat: targetLat, lon: targetLon, name: targetName };

    currentRoute = viewer.entities.add({
        name: `Route to ${targetName}`,
        polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(pathCoordinates),
            width: 6,
            material: new Cesium.PolylineOutlineMaterialProperty({
                color: Cesium.Color.BLUE,
                outlineWidth: 2,
                outlineColor: Cesium.Color.WHITE
            }),
            clampToGround: true
        }
    });

    if (!navigationActive) {
        addRoutePins(startPoint.latitude, startPoint.longitude, targetLat, targetLon);
        if (!usingCustomStart) {
            showStartBanner('Your Location');
        }
        showEndBanner(targetName);
        collapseSearchPanel();
    }

    let totalDistance = startResult.distance + endResult.distance;
    for (let i = 0; i < path.length - 1; i++) {
        const node1 = getNodeById(path[i]);
        const node2 = getNodeById(path[i + 1]);
        if (node1 && node2) {
            totalDistance += calculateDistance(
                node1.latitude, node1.longitude,
                node2.latitude, node2.longitude
            );
        }
    }
    
    console.log(`📏 Total distance: ${totalDistance.toFixed(0)} meters (following pathways)`);
    console.log(`🚶 Estimated walking time: ${Math.ceil(totalDistance / CONFIG.NAVIGATION.WALKING_SPEED)} minutes`);
    
    if (!navigationActive) {
        zoomToShowRoute(startPoint.latitude, startPoint.longitude, targetLat, targetLon);
        showRouteInfo(totalDistance, targetName, usingCustomStart);
    }
    scheduleRender();
    if (!navigationActive && !usingCustomStart) {
        setTimeout(() => {
            import('./tripMode.js').catch(() => {});
        }, 500);
    }
    
    return {
        distance: totalDistance,
        walkingTime: Math.ceil(totalDistance / CONFIG.NAVIGATION.WALKING_SPEED),
        pathNodes: path.length
    };
}

function drawDirectRoute(targetLat, targetLon, targetName) {
    const startPoint = customStartPoint || userLocation;
    currentRoute = viewer.entities.add({
        name: `Direct route to ${targetName}`,
        polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([
                startPoint.longitude, startPoint.latitude,
                targetLon, targetLat
            ]),
            width: 5,
            material: new Cesium.PolylineOutlineMaterialProperty({
                color: Cesium.Color.RED,
                outlineWidth: 2,
                outlineColor: Cesium.Color.WHITE
            }),
            clampToGround: true
        }
    });

    if (!navigationActive) {
        addRoutePins(startPoint.latitude, startPoint.longitude, targetLat, targetLon);
        const usingCustomStart = customStartPoint !== null;
        if (!usingCustomStart) {
            showStartBanner('Your Location');
        }
        showEndBanner(targetName);
        collapseSearchPanel();
    }

    const distance = calculateDistance(
        startPoint.latitude, startPoint.longitude,
        targetLat, targetLon
    );

    if (!navigationActive) {
        zoomToShowRoute(startPoint.latitude, startPoint.longitude, targetLat, targetLon);
        showRouteInfo(distance, targetName, customStartPoint !== null);
    }
}

function showRouteInfo(distance, targetName, usingCustomStart = false) {
    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');
    const walkingTime = Math.ceil(distance / CONFIG.NAVIGATION.WALKING_SPEED);

    import('../map/userLocation.js').then(({ userLocation, isInsideCampus, getIsManualLocation }) => {
        const onCampus = userLocation && isInsideCampus(
            userLocation.latitude,
            userLocation.longitude
        );
        const manualLocation = getIsManualLocation();

        let startTripButton;
        let infoMessage = '';

        if (usingCustomStart) {
            startTripButton = `<button disabled
                style="flex:1; padding:10px; background:#aaa; color:white; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:not-allowed;"
                title="Start Trip is not available for building-to-building routes">
                📍 Building-to-building
               </button>`;
            infoMessage = `<p style="color:#2980b9; font-size:11px; margin:4px 0;">ℹ️ Start Trip requires live GPS location.</p>`;
        } else if (manualLocation) {
            startTripButton = `<button disabled
                style="flex:1; padding:10px; background:#aaa; color:white; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:not-allowed;"
                title="Start Trip requires real-time GPS tracking">
                📍 Requires GPS
               </button>`;
            infoMessage = `<p style="color:#e67e22; font-size:11px; margin:4px 0;">ℹ️ Start Trip requires GPS. Use "Use GPS" to enable.</p>`;
        } else if (!onCampus) {
            startTripButton = `<button disabled
                style="flex:1; padding:10px; background:#aaa; color:white; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:not-allowed;"
                title="You must be on campus to start navigation">
                📍 Not on campus
               </button>`;
            infoMessage = `<p style="color:#e74c3c; font-size:11px; margin:4px 0;">⚠️ Must be on campus to start navigation.</p>`;
        } else {
            startTripButton = `<button id="startTripBtn" onclick="window.startTripFromRoute()"
                style="flex:1; padding:10px; background:#27ae60; color:white; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer;">
                ▶ Start Trip
               </button>`;
        }

        const routeLabel = usingCustomStart
            ? `🗺️ ${customStartPoint.name} → ${targetName}`
            : `🗺️ Route to ${targetName}`;

        infoContent.innerHTML = `
            <h3 style="margin:8px 0 6px; font-size:16px;">${routeLabel}</h3>
            <p style="margin:4px 0; font-size:13px;"><strong>${distance.toFixed(0)}m</strong> · ~${walkingTime} min walk</p>
            ${infoMessage}
            <div style="display:flex; gap:8px; margin-top:8px;">
                ${startTripButton}
                <button onclick="clearRoute()"
                    style="flex:1; padding:10px; background:#ff6600; color:white; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">
                    Clear
                </button>
            </div>
        `;

        infoPanel.style.display = 'block';
    });
}

export function clearRoute(skipConfirm = false) {
    if (!currentRoute) return;

    if (!skipConfirm) {
        const confirmed = confirm('This will clear the current route and trip information. Continue?');
        if (!confirmed) return;
    }

    clearAllDirectionsState();
    console.log("🗑️ Route cleared");
}

export function clearAllDirectionsState() {
    if (currentRoute) {
        viewer.entities.remove(currentRoute);
        currentRoute = null;
    }
    removeRoutePins();
    clearLastDestination();
    hideStartBanner();
    hideEndBanner();
    customStartPoint = null;
    currentRoutePath = [];
    currentDestination = { lat: null, lon: null, name: null };
    document.getElementById('info-panel').style.display = 'none';
    expandSearchPanel();
    scheduleRender();
}

export function updateRouteDisplay(userLat, userLon, fromIndex) {
    if (!currentRoute || !currentRoutePath || currentRoutePath.length === 0) return;

    const coords = [userLon, userLat];
    for (let i = fromIndex; i < currentRoutePath.length; i++) {
        coords.push(currentRoutePath[i].lon, currentRoutePath[i].lat);
    }

    currentRoute.polyline.positions = Cesium.Cartesian3.fromDegreesArray(coords);
    scheduleRender();
}

window.clearRoute = clearRoute;
window.startTripFromRoute = function() {
    const btn = document.getElementById('startTripBtn');
    if (btn) {
        btn.textContent = '⏳ Starting...';
        btn.style.background = '#95a5a6';
        btn.disabled = true;
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            import('./tripMode.js').then(({ startTrip }) => {
                startTrip(
                    currentRoutePath,
                    currentDestination.name,
                    currentDestination.lat,
                    currentDestination.lon
                );
            }).catch(err => {
                console.error("Failed to load trip mode:", err);
                if (btn) {
                    btn.textContent = '▶ Start Trip';
                    btn.style.background = '#27ae60';
                    btn.disabled = false;
                }
            });
        });
    });
};

window.clearCustomStart = function() {
    clearCustomStartPoint();
};

window.clearEndPoint = function() {
    if (!currentRoute) return;
    const confirmed = confirm('Clear the destination? You can re-select a new destination.');
    if (!confirmed) return;

    const savedStart = customStartPoint ? { ...customStartPoint } : null;
    const savedStartName = customStartPoint ? customStartPoint.name : 'Your Location';

    viewer.entities.remove(currentRoute);
    currentRoute = null;
    removeRoutePins();
    clearLastDestination();
    hideEndBanner();
    currentRoutePath = [];
    currentDestination = { lat: null, lon: null, name: null };
    scheduleRender();

    import('../ui/infoPanel.js').then(({ showDestinationReselect }) => {
        showDestinationReselect(savedStartName, savedStart);
    });

    console.log("🗑️ End point cleared");
};

function collapseSearchPanel() {
    const searchRow = document.getElementById('search-row');
    const locationSection = document.getElementById('location-section');
    if (searchRow) searchRow.style.display = 'none';
    if (locationSection) locationSection.style.display = 'none';
}

function expandSearchPanel() {
    const searchRow = document.getElementById('search-row');
    const locationSection = document.getElementById('location-section');
    if (searchRow) searchRow.style.display = '';
    if (locationSection) locationSection.style.display = '';
}

function showStartBanner(name) {
    let banner = document.getElementById('custom-start-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'custom-start-banner';
        const container = document.getElementById('ui-content');
        if (container) container.appendChild(banner);
    }
    const showClose = customStartPoint !== null;
    banner.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; padding:8px 12px; background:#e8f4fd; border:1px solid #b3d9f2; border-radius:8px; font-size:13px;">
            <span>📌 Start: <strong>${name}</strong></span>
            ${showClose ? `<button onclick="window.clearCustomStart()"
                style="background:none !important; border:none !important; color:#e74c3c !important; font-size:16px !important; cursor:pointer; padding:0 4px !important; width:auto !important;">✕</button>` : ''}
        </div>
    `;
    banner.style.display = 'block';
}

function hideStartBanner() {
    const banner = document.getElementById('custom-start-banner');
    if (banner) banner.style.display = 'none';
}

function showEndBanner(name) {
    let banner = document.getElementById('custom-end-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'custom-end-banner';
        const container = document.getElementById('ui-content');
        if (container) container.appendChild(banner);
    }
    banner.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:4px; padding:8px 12px; background:#fde8e8; border:1px solid #f2b3b3; border-radius:8px; font-size:13px;">
            <span>🏁 End: <strong>${name}</strong></span>
            <button onclick="window.clearEndPoint()"
                style="background:none !important; border:none !important; color:#e74c3c !important; font-size:16px !important; cursor:pointer; padding:0 4px !important; width:auto !important;">✕</button>
        </div>
    `;
    banner.style.display = 'block';
}

function hideEndBanner() {
    const banner = document.getElementById('custom-end-banner');
    if (banner) banner.style.display = 'none';
}