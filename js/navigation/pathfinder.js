import { viewer } from '../map/viewer.js';
import { userLocation } from '../map/userLocation.js';
import { setLastDestination, clearLastDestination } from '../map/userLocation.js';
import { findNearestNode, findPath, getNodeById } from './pathGraph.js';

let currentRoutePath = [];
let currentDestination = { lat: null, lon: null, name: null };
let customStartPoint = null;

export function getCurrentRoutePath() { return currentRoutePath; }
export function getCurrentDestination() { return currentDestination; }

export function setCustomStartPoint(lat, lon, name) {
    if (currentRoute) {
        viewer.entities.remove(currentRoute);
        currentRoute = null;
        clearLastDestination();
        hideEndBanner();
        currentRoutePath = [];
        currentDestination = { lat: null, lon: null, name: null };
        document.getElementById('info-panel').style.display = 'none';
        viewer.scene.requestRender();
    }
    customStartPoint = { latitude: lat, longitude: lon, name };
    console.log(`📌 Custom start set: ${name}`);
    showStartBanner(name);
}

export function clearCustomStartPoint(skipConfirm = false) {
    if (!skipConfirm && currentRoute) {
        const confirmed = confirm('This will clear the current route and trip information. Continue?');
        if (!confirmed) return;
    }

    customStartPoint = null;
    hideStartBanner();

    if (currentRoute) {
        viewer.entities.remove(currentRoute);
        currentRoute = null;
        clearLastDestination();
        hideEndBanner();
        currentRoutePath = [];
        currentDestination = { lat: null, lon: null, name: null };
        document.getElementById('info-panel').style.display = 'none';
        expandSearchPanel();
        viewer.scene.requestRender();
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

// Calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const cosLat = Math.cos((lat1 + lat2) / 2 * toRad);
    return R * Math.sqrt(dLat * dLat + dLon * dLon * cosLat * cosLat);
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

// NEW: Draw route using pathfinding
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

    // Remove previous route
    if (currentRoute) {
        viewer.entities.remove(currentRoute);
    }

    // Find nearest nodes
    const startResult = findNearestNode(startPoint.latitude, startPoint.longitude);
    const endResult = findNearestNode(targetLat, targetLon);
    
    if (!startResult || !endResult) {
        console.error("Could not find pathway nodes");
        return;
    }
    
    console.log(`Start node: ${startResult.distance.toFixed(1)}m away`);
    console.log(`End node: ${endResult.distance.toFixed(1)}m away`);
    
    // Find path between nodes
    const path = findPath(startResult.node, endResult.node);
    
    if (!path) {
        alert("Could not find a route. Using direct path.");
        drawDirectRoute(targetLat, targetLon, targetName);
        return;
    }
    
    // Convert path (node IDs) to coordinates
    const pathCoordinates = [];
    
    // Add start point
    pathCoordinates.push(startPoint.longitude, startPoint.latitude);

    // Add path nodes
    path.forEach(nodeId => {
        const node = getNodeById(nodeId);
        if (node) {
            pathCoordinates.push(node.longitude, node.latitude);
        }
    });

    // Add end point (target building)
    pathCoordinates.push(targetLon, targetLat);

    // Store path for Start Trip feature
    currentRoutePath = [];
    currentRoutePath.push({ lat: startPoint.latitude, lon: startPoint.longitude });
    path.forEach(nodeId => {
        const node = getNodeById(nodeId);
        if (node) currentRoutePath.push({ lat: node.latitude, lon: node.longitude });
    });
    currentRoutePath.push({ lat: targetLat, lon: targetLon });
    currentDestination = { lat: targetLat, lon: targetLon, name: targetName };

    // Draw the route
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

    // Show start/end banners
    if (!usingCustomStart) {
        showStartBanner('Your Location');
    }
    showEndBanner(targetName);
    collapseSearchPanel();

    // Calculate total distance
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
    console.log(`🚶 Estimated walking time: ${Math.ceil(totalDistance / 80)} minutes`);
    
    zoomToShowRoute(startPoint.latitude, startPoint.longitude, targetLat, targetLon);
    showRouteInfo(totalDistance, targetName, usingCustomStart);
    viewer.scene.requestRender();
    if (!usingCustomStart) {
        setTimeout(() => {
            import('./tripMode.js').catch(() => {});
        }, 500);
    }
    
    return {
        distance: totalDistance,
        walkingTime: Math.ceil(totalDistance / 80),
        pathNodes: path.length
    };
}

// Fallback: direct route if pathfinding fails
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

    const usingCustomStart = customStartPoint !== null;
    if (!usingCustomStart) {
        showStartBanner('Your Location');
    }
    showEndBanner(targetName);
    collapseSearchPanel();

    const distance = calculateDistance(
        startPoint.latitude, startPoint.longitude,
        targetLat, targetLon
    );

    zoomToShowRoute(startPoint.latitude, startPoint.longitude, targetLat, targetLon);
    showRouteInfo(distance, targetName, customStartPoint !== null);
}

function showRouteInfo(distance, targetName, usingCustomStart = false) {
    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');
    const walkingTime = Math.ceil(distance / 80);

    // Check if user is inside campus and using GPS
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

    viewer.entities.remove(currentRoute);
    currentRoute = null;
    clearLastDestination();
    hideStartBanner();
    hideEndBanner();
    customStartPoint = null;
    currentRoutePath = [];
    currentDestination = { lat: null, lon: null, name: null };
    document.getElementById('info-panel').style.display = 'none';
    expandSearchPanel();
    viewer.scene.requestRender();
    console.log("🗑️ Route cleared");
}

export function updateRouteDisplay(userLat, userLon, fromIndex) {
    if (!currentRoute || !currentRoutePath || currentRoutePath.length === 0) return;

    const coords = [userLon, userLat];
    for (let i = fromIndex; i < currentRoutePath.length; i++) {
        coords.push(currentRoutePath[i].lon, currentRoutePath[i].lat);
    }

    currentRoute.polyline.positions = Cesium.Cartesian3.fromDegreesArray(coords);
    viewer.scene.requestRender();
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

window.getDirections = function(lat, lon, name) {
    // Capture btn reference immediately
    const btn = document.getElementById('getDirectionsBtn');
    if (btn) {
        btn.textContent = '⏳ Getting directions...';
        btn.style.background = '#95a5a6';
        btn.disabled = true;
    }

    // Building-to-building: skip user location checks
    if (customStartPoint) {
        if (Math.abs(customStartPoint.latitude - lat) < 0.0001 &&
            Math.abs(customStartPoint.longitude - lon) < 0.0001) {
            alert('Start and destination are the same building.');
            if (btn) {
                btn.textContent = '🗺️ Get Directions';
                btn.style.background = '#3498db';
                btn.disabled = false;
            }
            return;
        }
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                drawRouteTo(lat, lon, name);
            });
        });
        return;
    }

    import('../map/userLocation.js').then(({ userLocation: currentLocation, isInsideCampus }) => {
        // Re-query btn inside callback in case DOM changed
        const currentBtn = document.getElementById('getDirectionsBtn');

        if (!currentLocation) {
            alert('Location not available. Please enable location services.');
            if (currentBtn) {
                currentBtn.textContent = '🗺️ Get Directions';
                currentBtn.style.background = '#3498db';
                currentBtn.disabled = false;
            }
            return;
        }

        if (!isInsideCampus(currentLocation.latitude, currentLocation.longitude)) {
            if (currentBtn) {
                // Remove existing warning to prevent stacking
                const existingWarning = document.getElementById('campus-warning');
                if (existingWarning) existingWarning.remove();

                currentBtn.insertAdjacentHTML('beforebegin', `
                    <p id="campus-warning" style="color:#e74c3c; font-size:12px; margin-bottom:8px;">
                        ⚠️ You must be on Curtin Bentley campus to get directions.
                    </p>
                `);
                currentBtn.textContent = '🗺️ Get Directions';
                currentBtn.style.background = '#3498db';
                currentBtn.disabled = false;
            }
            return;
        }

        // User is on campus - draw route!
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                drawRouteTo(lat, lon, name);
            });
        });
    }).catch(err => {
        console.error('getDirections error:', err);
        const currentBtn = document.getElementById('getDirectionsBtn');
        if (currentBtn) {
            currentBtn.textContent = '🗺️ Get Directions';
            currentBtn.style.background = '#3498db';
            currentBtn.disabled = false;
        }
    });
};

window.clearCustomStart = function() {
    clearCustomStartPoint();
};

window.clearEndPoint = function() {
    if (!currentRoute) return;
    const confirmed = confirm('This will clear the current route and trip information. Continue?');
    if (!confirmed) return;

    viewer.entities.remove(currentRoute);
    currentRoute = null;
    clearLastDestination();
    hideEndBanner();
    currentRoutePath = [];
    currentDestination = { lat: null, lon: null, name: null };
    document.getElementById('info-panel').style.display = 'none';
    viewer.scene.requestRender();

    if (!customStartPoint) {
        hideStartBanner();
        expandSearchPanel();
    }
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