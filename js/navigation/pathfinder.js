import { viewer } from '../map/viewer.js';
import { userLocation } from '../map/userLocation.js';
import { setLastDestination, clearLastDestination } from '../map/userLocation.js';
import { findNearestNode, findPath, getPathwayGraph, getNodeById } from './pathGraph.js';

let currentRoutePath = [];
let currentDestination = { lat: null, lon: null, name: null };

export function getCurrentRoutePath() { return currentRoutePath; }
export function getCurrentDestination() { return currentDestination; }

let currentRoute = null;

// Calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

function zoomToShowRoute(targetLat, targetLon) {
    const positions = [
        Cesium.Cartesian3.fromDegrees(userLocation.longitude, userLocation.latitude, 0),
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
    
    if (!userLocation) {
        alert("Cannot find route - user location not available");
        return;
    }
    // Save destination for route redrawing
    setLastDestination(targetLat, targetLon, targetName);

    // Remove previous route
    if (currentRoute) {
        viewer.entities.remove(currentRoute);
    }
    
    // Find nearest nodes
    const startResult = findNearestNode(userLocation.latitude, userLocation.longitude);
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
    const graph = getPathwayGraph();
    const pathCoordinates = [];
    
    // Add start point (user location)
    pathCoordinates.push(userLocation.longitude, userLocation.latitude);
    
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
    currentRoutePath.push({ lat: userLocation.latitude, lon: userLocation.longitude });
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
    
    zoomToShowRoute(targetLat, targetLon);
    showRouteInfo(totalDistance, targetName);
    viewer.scene.requestRender(); 
    setTimeout(() => {
        import('./tripMode.js').catch(() => {});
    }, 500);
    
    return {
        distance: totalDistance,
        walkingTime: Math.ceil(totalDistance / 80),
        pathNodes: path.length
    };
}

// Fallback: direct route if pathfinding fails
function drawDirectRoute(targetLat, targetLon, targetName) {
    currentRoute = viewer.entities.add({
        name: `Direct route to ${targetName}`,
        polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([
                userLocation.longitude, userLocation.latitude,
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
    
    const distance = calculateDistance(
        userLocation.latitude, userLocation.longitude,
        targetLat, targetLon
    );
    
    zoomToShowRoute(targetLat, targetLon);
    showRouteInfo(distance, targetName);
}

function showRouteInfo(distance, targetName) {
    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');
    const walkingTime = Math.ceil(distance / 80);

    // Check if user is inside campus
    import('../map/userLocation.js').then(({ userLocation, isInsideCampus }) => {
        const onCampus = userLocation && isInsideCampus(
            userLocation.latitude,
            userLocation.longitude
        );

        const startTripButton = onCampus
            ? `<button id="startTripBtn" onclick="window.startTripFromRoute()"
                style="flex:1; padding:11px; background:#27ae60; color:white; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">
                ▶ Start Trip
               </button>`
            : `<button disabled
                style="flex:1; padding:11px; background:#aaa; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:not-allowed;"
                title="You must be on campus to start navigation">
                📍 Not on campus
               </button>`;

        infoContent.innerHTML = `
            <h3>🗺️ Route to ${targetName}</h3>
            <p><strong>Distance:</strong> ${distance.toFixed(0)} meters</p>
            <p><strong>Walking Time:</strong> ~${walkingTime} minute${walkingTime > 1 ? 's' : ''}</p>
            <p><em>Blue line follows campus pathways.</em></p>
            ${!onCampus ? `<p style="color:#e74c3c; font-size:12px;">⚠️ You must be on Curtin Bentley campus to use navigation.</p>` : ''}
            <div style="display:flex; gap:8px; margin-top:12px;">
                ${startTripButton}
                <button onclick="clearRoute()"
                    style="flex:1; padding:11px; background:#ff6600; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer;">
                    Clear
                </button>
            </div>
        `;

        infoPanel.style.display = 'block';
    });
}

export function clearRoute() {
    if (currentRoute) {
        viewer.entities.remove(currentRoute);
        currentRoute = null;
        clearLastDestination();
        viewer.scene.requestRender();
        console.log("🗑️ Route cleared");
    }
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