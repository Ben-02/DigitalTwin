function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let pendingDirections = null;

window.getDirectionsFromPanel = function() {
    if (pendingDirections) {
        window.getDirections(pendingDirections.lat, pendingDirections.lon, pendingDirections.name);
    }
};

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

// NEW: Show building info with Get Directions button (used by search)
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

    infoHTML += `
        <div style="margin-top: 12px;">
            <button id="getDirectionsBtn"
                onclick="window.getDirectionsFromPanel()"
                style="width:100%; padding:11px; background:#3498db; color:white; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">
                🗺️ Get Directions
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

    infoContent.innerHTML = `
        <h3>Building</h3>
        <p><em>Detailed information not available</em></p>
        <p><strong>OSM ID:</strong> ${escapeHtml(String(elementId))}</p>
        <p><strong>Height:</strong> ${height}m</p>
        <p><strong>Location:</strong> ${lat.toFixed(5)}, ${lon.toFixed(5)}</p>
        <div style="margin-top: 12px;">
            <button id="getDirectionsBtn"
                onclick="window.getDirectionsFromPanel()"
                style="width:100%; padding:11px; background:#3498db; color:white; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">
                🗺️ Get Directions
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

    infoContent.innerHTML = `
        <h3>Building ${escapeHtml(displayNum)}</h3>
        <p><strong>Name:</strong> ${escapeHtml(displayName)}</p>
        <div style="margin-top: 12px;">
            <button id="getDirectionsBtn"
                onclick="window.getDirectionsFromPanel()"
                style="width:100%; padding:11px; background:#3498db; color:white; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">
                🗺️ Get Directions
            </button>
        </div>
    `;

    infoPanel.style.display = 'block';
}

export function closeInfoPanel() {
    document.getElementById('info-panel').style.display = 'none';
}