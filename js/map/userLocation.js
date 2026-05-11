import { viewer } from './viewer.js';

export let userLocation = null;
export let userLocationMarker = null;
let isManualLocation = false;
let gpsLocation = null;
let manualLocationHandler = null;
let locationPermissionDenied = false;

// Store last destination for route redrawing
let lastDestination = null;

export function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            console.log("📍 Requesting user location...");
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    
                    gpsLocation = { ...userLocation };
                    
                    console.log(`✅ User location: ${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}`);
                    console.log(`Accuracy: ${userLocation.accuracy.toFixed(1)} meters`);
                    
                    if (userLocation.accuracy > 50) {
                        console.warn(`⚠️ Low accuracy (${userLocation.accuracy.toFixed(0)}m) - consider manual adjustment`);
                    }
                    
                    showUserLocationMarker();
                    resolve(userLocation);
                },
                (error) => {
                    console.error("❌ Error getting location:", error.message);

                    if (error.code === 1) {
                        // User denied location access
                        locationPermissionDenied = true;
                        console.warn("⚠️ Location permission denied by user");
                        updateLocationLabel('denied');
                        resolve(null);
                        return;
                    }

                    // Other errors (timeout, unavailable) - use default campus location
                    userLocation = {
                        latitude: -32.0063,
                        longitude: 115.8945,
                        accuracy: null
                    };
                    gpsLocation = { ...userLocation };
                    console.log("⚠️ Using default campus entrance location");
                    showUserLocationMarker();
                    resolve(userLocation);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            console.error("❌ Geolocation not supported by this browser");
            
            userLocation = {
                latitude: -32.0063,
                longitude: 115.8945,
                accuracy: null
            };
            gpsLocation = { ...userLocation };
            showUserLocationMarker();
            resolve(userLocation);
        }
    });
}

function showUserLocationMarker() {
    if (userLocationMarker) {
        viewer.entities.remove(userLocationMarker);
    }
    
    const labelText = isManualLocation 
        ? 'You are here (manual)' 
        : (userLocation.accuracy 
            ? `You are here (±${userLocation.accuracy.toFixed(0)}m)` 
            : 'You are here');
    
    userLocationMarker = viewer.entities.add({
        name: 'Your Location',
        position: Cesium.Cartesian3.fromDegrees(
            userLocation.longitude,
            userLocation.latitude,
            2
        ),
        point: {
            pixelSize: 15,
            color: isManualLocation ? Cesium.Color.GREEN : Cesium.Color.BLUE,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 3,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        label: {
            text: labelText,
            font: '14px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -25),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
    });
    
    console.log("✅ User location marker added to map");
}

export function enableManualLocationSetting() {
    // If permission was denied, try to re-request GPS first
    if (locationPermissionDenied) {
        console.log("🔄 Re-requesting location permission...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Permission granted!
                locationPermissionDenied = false;
                userLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                gpsLocation = { ...userLocation };
                isManualLocation = false;
                showUserLocationMarker();
                updateLocationLabel('gps');
                updateLocationButtons();
                console.log("✅ Location permission granted!");
            },
            (error) => {
                if (error.code === 1) {
                    // Still denied - fall back to manual mode
                    console.warn("⚠️ Still denied, entering manual mode");
                    alert('Location is blocked in your browser settings.\nYou can set your location manually by clicking on the map.');
                    enterManualClickMode();
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
        return;
    }

    enterManualClickMode();
}

function enterManualClickMode() {
    console.log("🖱️ Manual location mode enabled - click on the map to set your position");
    
    window.buildingClickEnabled = false;
    console.log("🚫 Building clicks disabled");
    
    showManualLocationOverlay();
    
    manualLocationHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    manualLocationHandler.setInputAction(function(click) {
        const ellipsoid = viewer.scene.globe.ellipsoid;
        const cartesian = viewer.camera.pickEllipsoid(click.position, ellipsoid);
        
        if (Cesium.defined(cartesian)) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            
            userLocation = {
                latitude: latitude,
                longitude: longitude,
                accuracy: 0
            };
            
            isManualLocation = true;
            
            console.log(`📍 Manual location set: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            
            showUserLocationMarker();
            hideManualLocationOverlay();
            
            if (manualLocationHandler) {
                manualLocationHandler.destroy();
                manualLocationHandler = null;
            }
            
            window.buildingClickEnabled = true;
            console.log("✅ Building clicks re-enabled");
            
            updateLocationLabel('manual');
            updateLocationButtons();
            
            if (lastDestination) {
                console.log("🔄 Redrawing route from new location...");
                import('../navigation/pathfinder.js').then(({ drawRouteTo }) => {
                    drawRouteTo(
                        lastDestination.latitude,
                        lastDestination.longitude,
                        lastDestination.name
                    );
                });
            }
            
            alert('✅ Your location has been updated!' + 
                  (lastDestination ? ' Route has been recalculated.' : ' Search for a building to see the route.'));
        } else {
            console.warn("Could not pick position - try clicking on the terrain");
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

export function cancelManualLocationMode() {
    console.log("❌ Manual location mode cancelled");
    
    if (manualLocationHandler) {
        manualLocationHandler.destroy();
        manualLocationHandler = null;
    }
    
    hideManualLocationOverlay();
    
    window.buildingClickEnabled = true;
    console.log("✅ Building clicks re-enabled");
    
    alert('Manual location mode cancelled');
}

export function revertToGPSLocation() {
    if (!gpsLocation) {
        alert('No GPS location available');
        return;
    }
    
    console.log("🔄 Reverting to GPS location");
    
    userLocation = { ...gpsLocation };
    isManualLocation = false;
    
    showUserLocationMarker();
    updateLocationButtons();
    
    // Redraw route if there's a destination
    if (lastDestination) {
        console.log("🔄 Redrawing route from GPS location...");
        
        import('../navigation/pathfinder.js').then(({ drawRouteTo }) => {
            drawRouteTo(
                lastDestination.latitude,
                lastDestination.longitude,
                lastDestination.name
            );
        });
    }
    
    alert('✅ Reverted to GPS location' + 
          (lastDestination ? '. Route has been recalculated.' : ''));
}

// NEW: Store destination when route is drawn
export function setLastDestination(lat, lon, name) {
    lastDestination = {
        latitude: lat,
        longitude: lon,
        name: name
    };
    console.log(`💾 Destination saved: ${name}`);
}

// NEW: Clear destination
export function clearLastDestination() {
    lastDestination = null;
    console.log("🗑️ Destination cleared");
}

function updateLocationLabel(type) {
    const span = document.getElementById('location-type-text');
    if (!span) return;

    if (type === 'gps') {
        span.textContent = 'GPS';
        span.style.color = '#007bff';
    } else if (type === 'manual') {
        span.textContent = 'Manual';
        span.style.color = '#28a745';
    } else if (type === 'denied') {
        span.textContent = 'Unavailable';
        span.style.color = '#dc3545';
    }
}

function showManualLocationOverlay() {
    let overlay = document.getElementById('manual-location-overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'manual-location-overlay';
        overlay.innerHTML = `
            <div style="background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 8px; text-align: center;">
                <h3 style="margin: 0 0 10px 0;">📍 Set Your Location</h3>
                <p style="margin: 0 0 15px 0;">Click anywhere on the map to set your current location</p>
                <button onclick="cancelManualLocationMode()" style="padding: 8px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    Cancel
                </button>
            </div>
        `;
        overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10000;
            pointer-events: auto;
        `;
        document.body.appendChild(overlay);
    }
    
    overlay.style.display = 'block';
}

function hideManualLocationOverlay() {
    const overlay = document.getElementById('manual-location-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function updateLocationButtons() {
    const container = document.getElementById('location-buttons-container');
    if (!container) return;

    if (locationPermissionDenied) {
        container.innerHTML = `
            <button onclick="enableManualLocationSetting()" 
                style="flex:1; padding:9px 12px; background:#dc3545; color:white; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">
                📍 Enable Location
            </button>
        `;
    } else if (isManualLocation) {
        container.innerHTML = `
            <button onclick="revertToGPSLocation()" 
                style="flex:1; padding:9px 12px; background:#ffc107; color:#000; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">
                ↩️ Use GPS
            </button>
            <button onclick="enableManualLocationSetting()" 
                style="flex:1; padding:9px 12px; background:#28a745; color:white; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">
                📍 Set New
            </button>
        `;
    } else {
        container.innerHTML = `
            <button onclick="enableManualLocationSetting()" 
                style="flex:1; padding:9px 12px; background:#28a745; color:white; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">
                📍 Set My Location
            </button>
            <button onclick="updateUserLocation()" 
                style="flex:1; padding:9px 12px; background:#6c757d; color:white; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">
                🔄 Refresh GPS
            </button>
        `;
    }
}

export function updateUserLocation() {
    isManualLocation = false;
    getUserLocation().then(() => {
        updateLocationButtons();
        
        // Redraw route if there's a destination
        if (lastDestination) {
            console.log("🔄 Redrawing route from refreshed GPS location...");
            
            import('../navigation/pathfinder.js').then(({ drawRouteTo }) => {
                drawRouteTo(
                    lastDestination.latitude,
                    lastDestination.longitude,
                    lastDestination.name
                );
            });
        }
    });
}

export function updatePositionDuringNavigation(lat, lon) {
    userLocation = {
        ...userLocation,
        latitude: lat,
        longitude: lon
    };
    
    if (userLocationMarker) {
        userLocationMarker.position = new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.fromDegrees(lon, lat, 2)
        );
    }
}

window.enableManualLocationSetting = enableManualLocationSetting;
window.updateUserLocation = updateUserLocation;
window.cancelManualLocationMode = cancelManualLocationMode;
window.revertToGPSLocation = revertToGPSLocation;