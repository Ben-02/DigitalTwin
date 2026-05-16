function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let pendingDirections = null;
let pendingBuildingInfo = null;
let directionsMapHandler = null;

export function showBuildingInfo(entity) {
    const props = entity.properties;

    const rawNum = props['addr:housenumber']?._value || '';
    const buildingName = props['addr:housename']?._value || props.name?._value || 'Unknown Building';

    function extractNumFromName(name) {
        const match = name.match(/^(\d+[A-Z]?)\s/);
        return match ? match[1] : '';
    }

    const buildingNum = rawNum || extractNumFromName(buildingName) || 'N/A';
    const amenity = props.amenity?._value || '';
    const healthcare = props.healthcare?._value || '';
    const street = props['addr:street']?._value || '';
    const suburb = props['addr:suburb']?._value || '';

    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');

    let infoHTML = `
        <h3>Building ${escapeHtml(buildingNum)}</h3>
        <p><strong>Name:</strong> ${escapeHtml(buildingName)}</p>
    `;

    if (street) infoHTML += `<p><strong>Street:</strong> ${escapeHtml(street)}</p>`;
    if (suburb) infoHTML += `<p><strong>Suburb:</strong> ${escapeHtml(suburb)}</p>`;
    if (amenity) infoHTML += `<p><strong>Amenity:</strong> ${escapeHtml(amenity)}</p>`;
    if (healthcare) infoHTML += `<p><strong>Type:</strong> Healthcare Facility</p>`;

    infoContent.innerHTML = infoHTML;
    infoPanel.style.display = 'block';
}

export function showBuildingInfoWithDirections(entity, lat, lon, buildingName) {
    const props = entity.properties;

    const rawNum = props['addr:housenumber']?._value || '';
    const rawName = props['addr:housename']?._value || props.name?._value || '';

    function extractNumFromName(name) {
        const match = name.match(/^(\d+[A-Z]?)\s/);
        return match ? match[1] : '';
    }

    const buildingNum = rawNum || extractNumFromName(rawName) || 'N/A';
    const displayName = rawName || 'Unknown Building';
    const amenity = props.amenity?._value || '';
    const healthcare = props.healthcare?._value || '';
    const street = props['addr:street']?._value || '';
    const suburb = props['addr:suburb']?._value || '';

    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');

    let infoHTML = `
        <h3>Building ${escapeHtml(buildingNum)}</h3>
        <p><strong>Name:</strong> ${escapeHtml(displayName)}</p>
    `;

    if (street) infoHTML += `<p><strong>Street:</strong> ${escapeHtml(street)}</p>`;
    if (suburb) infoHTML += `<p><strong>Suburb:</strong> ${escapeHtml(suburb)}</p>`;
    if (amenity) infoHTML += `<p><strong>Amenity:</strong> ${escapeHtml(amenity)}</p>`;
    if (healthcare) infoHTML += `<p><strong>Type:</strong> Healthcare Facility</p>`;

    pendingDirections = { lat, lon, name: buildingName };
    pendingBuildingInfo = { type: 'metadata', args: [entity, lat, lon, buildingName] };

    infoHTML += `
        <div style="margin-top:12px;">
            <button onclick="window.showDirections()"
                style="width:100%; padding:12px; background:#3498db; color:white; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">
                🗺️ Directions
            </button>
        </div>
    `;

    infoContent.innerHTML = infoHTML;
    infoPanel.style.display = 'block';
}

export function showGenericBuildingInfo(elementId, lat, lon, height) {
    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');

    pendingDirections = { lat, lon, name: 'Building' };
    pendingBuildingInfo = { type: 'generic', args: [elementId, lat, lon, height] };

    infoContent.innerHTML = `
        <h3>Building</h3>
        <p><em>Detailed information not available</em></p>
        <p><strong>OSM ID:</strong> ${escapeHtml(String(elementId))}</p>
        <p><strong>Height:</strong> ${height}m</p>
        <p><strong>Location:</strong> ${lat.toFixed(5)}, ${lon.toFixed(5)}</p>
        <div style="margin-top:12px;">
            <button onclick="window.showDirections()"
                style="width:100%; padding:12px; background:#3498db; color:white; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">
                🗺️ Directions
            </button>
        </div>
    `;

    infoPanel.style.display = 'block';
}

export function showManualBuildingInfo(data, lat, lon) {
    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');

    const displayNum = data.number || 'Unknown';
    const displayName = data.name || 'Unknown Building';

    pendingDirections = { lat, lon, name: `Building ${displayNum}` };
    pendingBuildingInfo = { type: 'manual', args: [data, lat, lon] };

    infoContent.innerHTML = `
        <h3>Building ${escapeHtml(displayNum)}</h3>
        <p><strong>Name:</strong> ${escapeHtml(displayName)}</p>
        <div style="margin-top:12px;">
            <button onclick="window.showDirections()"
                style="width:100%; padding:12px; background:#3498db; color:white; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">
                🗺️ Directions
            </button>
        </div>
    `;

    infoPanel.style.display = 'block';
}

// ===== DIRECTIONS PANEL =====

function showDirectionsPanel() {
    if (!pendingDirections) return;

    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');

    infoContent.innerHTML = `
        <h3 style="margin:10px 0 6px;">Directions</h3>
        <p style="margin:4px 0 12px; font-size:14px;">To: <strong>${escapeHtml(pendingDirections.name)}</strong></p>
        <hr style="border:none; border-top:1px solid #eee; margin:0 0 12px;">
        <p style="margin:0 0 10px; font-size:13px; color:#666; font-weight:600;">Choose starting point:</p>
        <div style="display:flex; flex-direction:column; gap:8px;">
            <button onclick="window.directionsFromGPS()"
                style="width:100%; padding:12px; background:#27ae60; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; text-align:left;">
                📍 My Location (GPS)
            </button>
            <button onclick="window.directionsPickOnMap()"
                style="width:100%; padding:12px; background:#e67e22; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; text-align:left;">
                🖱️ Pick on Map
            </button>
            <button onclick="window.directionsSearchBuilding()"
                style="width:100%; padding:12px; background:#3498db; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; text-align:left;">
                🏛️ Search Building
            </button>
        </div>
        <div id="directions-search-section" style="display:none; margin-top:8px;">
            <div style="display:flex; gap:6px;">
                <input type="text" id="directions-search-input"
                    placeholder="Building name or number..."
                    onkeydown="if(event.key==='Enter')window.directionsDoSearch()"
                    style="flex:1; padding:8px 10px; border:2px solid #ddd; border-radius:6px; font-size:13px; outline:none;" />
                <button onclick="window.directionsDoSearch()"
                    style="padding:8px 12px; background:#ff6600; color:white; border:none; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; width:auto;">
                    Go
                </button>
            </div>
            <div id="directions-search-results" style="margin-top:6px; max-height:150px; overflow-y:auto;"></div>
        </div>
        <p id="directions-message" style="display:none; font-size:12px; margin:8px 0 0;"></p>
        <button onclick="window.directionsGoBack()"
            style="width:100%; margin-top:12px; padding:10px; background:none; color:#666; border:1px solid #ddd; border-radius:8px; font-size:13px; cursor:pointer;">
            ← Back to building info
        </button>
    `;

    infoPanel.style.display = 'block';
}

function showDirectionsMessage(msg, color) {
    const el = document.getElementById('directions-message');
    if (el) {
        el.textContent = msg;
        el.style.color = color;
        el.style.display = 'block';
    }
}

// ===== PICK ON MAP (uses shared map-pick-panel) =====

// ===== WINDOW FUNCTIONS =====

window.showDirections = function() {
    showDirectionsPanel();
};

window.directionsFromGPS = function() {
    if (!pendingDirections) return;
    const { lat, lon, name } = pendingDirections;

    import('../map/userLocation.js').then(({ userLocation: loc, isInsideCampus }) => {
        if (!loc) {
            showDirectionsMessage('Location not available. Enable location services or use another option.', '#e74c3c');
            return;
        }
        if (!isInsideCampus(loc.latitude, loc.longitude)) {
            showDirectionsMessage('You must be on Curtin Bentley campus to use GPS directions.', '#e74c3c');
            return;
        }
        import('../navigation/pathfinder.js').then(({ drawRouteTo, clearCustomStartPoint, getCustomStartPoint }) => {
            if (getCustomStartPoint()) clearCustomStartPoint(true);
            drawRouteTo(lat, lon, name);
        });
    });
};

window.directionsPickOnMap = function() {
    if (!pendingDirections) return;
    window.buildingClickEnabled = false;

    import('../map/userLocation.js').then(({ showMapPickPanel, hideMapPickPanel }) => {
        showMapPickPanel('📍 Pick Starting Point', 'Tap the map to set your starting point', () => window.cancelDirectionsMapClick());
    });

    import('../map/camera.js').then(({ flyToCampus }) => flyToCampus());

    import('../map/viewer.js').then(({ viewer }) => {
        directionsMapHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        directionsMapHandler.setInputAction(function(click) {
            const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
            if (Cesium.defined(cartesian)) {
                const carto = Cesium.Cartographic.fromCartesian(cartesian);
                const lon = Cesium.Math.toDegrees(carto.longitude);
                const lat = Cesium.Math.toDegrees(carto.latitude);

                directionsMapHandler.destroy();
                directionsMapHandler = null;
                window.buildingClickEnabled = true;

                import('../map/userLocation.js').then(({ hideMapPickPanel }) => hideMapPickPanel());
                import('../navigation/pathfinder.js').then(({ setCustomStartPoint, drawRouteTo }) => {
                    setCustomStartPoint(lat, lon, 'Map point');
                    drawRouteTo(pendingDirections.lat, pendingDirections.lon, pendingDirections.name);
                });
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    });
};

window.cancelDirectionsMapClick = function() {
    if (directionsMapHandler) {
        directionsMapHandler.destroy();
        directionsMapHandler = null;
    }
    window.buildingClickEnabled = true;
    import('../map/userLocation.js').then(({ hideMapPickPanel }) => {
        hideMapPickPanel();
        showDirectionsPanel();
    });
};

window.directionsSearchBuilding = function() {
    const section = document.getElementById('directions-search-section');
    if (!section) return;
    const isVisible = section.style.display === 'block';
    section.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        const input = document.getElementById('directions-search-input');
        if (input) input.focus();
    }
};

window.directionsDoSearch = function() {
    const input = document.getElementById('directions-search-input');
    const term = input ? input.value.trim().toLowerCase() : '';
    if (!term) return;

    import('../data/metadata.js').then(({ buildingMetadataMap }) => {
        const results = [];

        for (let [elementId, entity] of buildingMetadataMap) {
            const props = entity.properties;
            const num = props['addr:housenumber']?._value || '';
            const name = props.name?._value || '';
            const houseName = props['addr:housename']?._value || '';

            if (num.toLowerCase().includes(term) ||
                name.toLowerCase().includes(term) ||
                houseName.toLowerCase().includes(term)) {

                let lat, lon;
                if (entity.position) {
                    const pos = entity.position.getValue(Cesium.JulianDate.now());
                    const carto = Cesium.Cartographic.fromCartesian(pos);
                    lat = Cesium.Math.toDegrees(carto.latitude);
                    lon = Cesium.Math.toDegrees(carto.longitude);
                } else if (entity.polygon?.hierarchy) {
                    const hierarchy = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
                    const positions = hierarchy.positions;
                    let sx = 0, sy = 0, sz = 0;
                    positions.forEach(p => { sx += p.x; sy += p.y; sz += p.z; });
                    const center = new Cesium.Cartesian3(sx / positions.length, sy / positions.length, sz / positions.length);
                    const carto = Cesium.Cartographic.fromCartesian(center);
                    lat = Cesium.Math.toDegrees(carto.latitude);
                    lon = Cesium.Math.toDegrees(carto.longitude);
                }

                if (lat && lon) {
                    const buildingNum = num || 'Unknown';
                    const buildingName = houseName || name || '';
                    const fullName = buildingNum !== 'Unknown' ? `Building ${buildingNum}` : buildingName;
                    const exact = num.toLowerCase() === term;
                    results.push({ lat, lon, buildingNum, buildingName, fullName, exact });
                }
            }
        }

        const container = document.getElementById('directions-search-results');
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = '<p style="color:#999; font-size:12px; margin:4px 0;">No buildings found</p>';
            return;
        }

        results.sort((a, b) => {
            if (a.exact !== b.exact) return a.exact ? -1 : 1;
            return a.buildingNum.localeCompare(b.buildingNum, undefined, { numeric: true });
        });

        const seen = new Set();
        const unique = results.filter(r => {
            const key = r.buildingNum !== 'Unknown' ? r.buildingNum : `${r.lat.toFixed(5)},${r.lon.toFixed(5)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        window._dirStartResults = unique;

        let html = '';
        unique.slice(0, 5).forEach((r, i) => {
            html += `<div onclick="window.selectStartBuilding(${i})"
                style="padding:8px 10px; margin:4px 0; background:#f8f8f8; border-radius:6px; cursor:pointer; border:1px solid #eee; font-size:13px;">
                <strong>${escapeHtml(r.fullName)}</strong>
                ${r.buildingName && r.buildingNum !== 'Unknown' ? `<br><span style="color:#666; font-size:11px;">${escapeHtml(r.buildingName)}</span>` : ''}
            </div>`;
        });

        if (unique.length > 5) {
            html += `<p style="color:#999; font-size:11px; margin:4px 0;">Showing first 5 of ${unique.length} results</p>`;
        }

        container.innerHTML = html;
    });
};

window.selectStartBuilding = function(index) {
    const results = window._dirStartResults;
    if (!results || !results[index] || !pendingDirections) return;

    const start = results[index];

    if (Math.abs(start.lat - pendingDirections.lat) < 0.0001 &&
        Math.abs(start.lon - pendingDirections.lon) < 0.0001) {
        showDirectionsMessage('Start and destination are the same building.', '#e74c3c');
        return;
    }

    import('../navigation/pathfinder.js').then(({ setCustomStartPoint, drawRouteTo }) => {
        setCustomStartPoint(start.lat, start.lon, start.fullName);
        drawRouteTo(pendingDirections.lat, pendingDirections.lon, pendingDirections.name);
    });
};

window.directionsGoBack = function() {
    if (!pendingBuildingInfo) return;
    const { type, args } = pendingBuildingInfo;
    switch (type) {
        case 'metadata':
            showBuildingInfoWithDirections(...args);
            break;
        case 'generic':
            showGenericBuildingInfo(...args);
            break;
        case 'manual':
            showManualBuildingInfo(...args);
            break;
    }
};

export function closeInfoPanel() {
    document.getElementById('info-panel').style.display = 'none';
}
