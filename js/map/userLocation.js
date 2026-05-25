import { viewer, scheduleRender } from './viewer.js';
import { CONFIG } from '../config.js';
import { flyToCampus } from './camera.js';
import { isInsideCampus } from '../utils/helper.js';

export let userLocation = null;
export let userLocationMarker = null;
let isManualLocation = false;

export function getIsManualLocation() {
    return isManualLocation;
}

let gpsLocation = null;
let manualLocationHandler = null;
let locationPermissionDenied = false;
let lastDestination = null;

export function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    
                    gpsLocation = { ...userLocation };

                    showUserLocationMarker();
                    resolve(userLocation);
                },
                (error) => {
                    console.error("Error getting location:", error.message);

                    if (error.code === 1) {
                        locationPermissionDenied = true;
                        updateLocationLabel('denied');
                        resolve(null);
                        return;
                    }

                    userLocation = {
                        latitude: -32.0063,
                        longitude: 115.8945,
                        accuracy: null
                    };
                    gpsLocation = { ...userLocation };
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
            console.error("Geolocation not supported by this browser");
            
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
        position: Cesium.Cartesian3.fromDegrees(
            userLocation.longitude,
            userLocation.latitude,
            0
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
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            showBackground: false
        }
    });

    scheduleRender();
}

export async function enableManualLocationSetting() {
    const { hasActiveRoute, clearRoute } = await import('../navigation/pathfinder.js');
    if (hasActiveRoute()) {
        const confirmed = confirm('Setting a new location will clear the current route and trip information. Continue?');
        if (!confirmed) return;
        clearRoute(true);
    }

    if (locationPermissionDenied) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
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
            },
            (error) => {
                if (error.code === 1) {
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
    flyToCampus();

    if (manualLocationHandler) {
        manualLocationHandler.destroy();
        manualLocationHandler = null;
    }

    window.buildingClickEnabled = false;

    showMapPickPanel('📍 Set Your Location', 'Tap the map to set your location', () => cancelManualLocationMode());

    manualLocationHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    manualLocationHandler.setInputAction(function(click) {
        const ellipsoid = viewer.scene.globe.ellipsoid;
        const cartesian = viewer.camera.pickEllipsoid(click.position, ellipsoid);
        
        if (Cesium.defined(cartesian)) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);

            if (!isInsideCampus(latitude, longitude)) {
                alert('Please select a location within the campus boundary.');
                return;
            }

            userLocation = {
                latitude: latitude,
                longitude: longitude,
                accuracy: 0
            };
            
            isManualLocation = true;
            
            showUserLocationMarker();
            hideMapPickPanel();
            
            if (manualLocationHandler) {
                manualLocationHandler.destroy();
                manualLocationHandler = null;
            }
            
            window.buildingClickEnabled = true;

            updateLocationLabel('manual');
            updateLocationButtons();
            
            if (lastDestination) {
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
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

export function cancelManualLocationMode() {
    if (manualLocationHandler) {
        manualLocationHandler.destroy();
        manualLocationHandler = null;
    }

    hideMapPickPanel();

    window.buildingClickEnabled = true;
}

export function revertToGPSLocation() {
    if (!gpsLocation) {
        alert('No GPS location available');
        return;
    }

    userLocation = { ...gpsLocation };
    isManualLocation = false;

    import('../navigation/pathfinder.js').then(({ getCustomStartPoint, clearCustomStartPoint }) => {
        if (getCustomStartPoint()) clearCustomStartPoint(true);
    });

    showUserLocationMarker();
    updateLocationButtons();
    
    if (lastDestination) {
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

export function setLastDestination(lat, lon, name) {
    lastDestination = {
        latitude: lat,
        longitude: lon,
        name: name
    };
}

export function clearLastDestination() {
    lastDestination = null;
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

let mapPickCancelCallback = null;
let savedInfoPanelDisplay = null;

export function showMapPickPanel(title, instruction, onCancel) {
    const infoPanel = document.getElementById('info-panel');
    savedInfoPanelDisplay = infoPanel.style.display;

    document.getElementById('ui-overlay').style.display = 'none';
    infoPanel.style.display = 'none';

    document.getElementById('map-pick-title').textContent = title;
    document.getElementById('map-pick-instruction').textContent = instruction;
    document.getElementById('map-pick-panel').style.display = '';

    mapPickCancelCallback = onCancel;
}

export function hideMapPickPanel() {
    document.getElementById('map-pick-panel').style.display = 'none';
    document.getElementById('ui-overlay').style.display = '';

    if (savedInfoPanelDisplay && savedInfoPanelDisplay !== 'none') {
        document.getElementById('info-panel').style.display = savedInfoPanelDisplay;
    }

    savedInfoPanelDisplay = null;
    mapPickCancelCallback = null;
}

window.cancelMapPick = function() {
    if (mapPickCancelCallback) mapPickCancelCallback();
};

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

    import('../navigation/pathfinder.js').then(({ getCustomStartPoint, clearCustomStartPoint }) => {
        if (getCustomStartPoint()) clearCustomStartPoint(true);
    });

    getUserLocation().then(() => {
        updateLocationButtons();
        
        if (lastDestination) {
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
    userLocation = { ...userLocation, latitude: lat, longitude: lon };

    if (userLocationMarker) {
        userLocationMarker.position = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
        if (userLocationMarker.label) {
            userLocationMarker.label.show = false;
        }
    }

    scheduleRender();
}

window.enableManualLocationSetting = enableManualLocationSetting;
window.updateUserLocation = updateUserLocation;
window.cancelManualLocationMode = cancelManualLocationMode;
window.revertToGPSLocation = revertToGPSLocation;

