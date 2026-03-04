export function showBuildingInfo(entity) {
    const props = entity.properties;
    
    const buildingNum = props['addr:housenumber']?._value || 'N/A';
    const buildingName = props['addr:housename']?._value || props.name?._value || 'Unknown Building';
    const amenity = props.amenity?._value || '';
    const healthcare = props.healthcare?._value || '';
    const street = props['addr:street']?._value || '';
    const suburb = props['addr:suburb']?._value || '';
    
    console.log('=== Building Metadata ===');
    console.log(`Building: ${buildingNum}`);
    console.log(`Name: ${buildingName}`);
    
    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');
    
    let infoHTML = `
        <h3>Building ${buildingNum}</h3>
        <p><strong>Name:</strong> ${buildingName}</p>
    `;
    
    if (street) infoHTML += `<p><strong>Street:</strong> ${street}</p>`;
    if (suburb) infoHTML += `<p><strong>Suburb:</strong> ${suburb}</p>`;
    if (amenity) infoHTML += `<p><strong>Amenity:</strong> ${amenity}</p>`;
    if (healthcare) infoHTML += `<p><strong>Type:</strong> Healthcare Facility</p>`;
    
    infoContent.innerHTML = infoHTML;
    infoPanel.style.display = 'block';
}

export function showGenericBuildingInfo(elementId, lat, lon, height) {
    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');
    
    infoContent.innerHTML = `
        <h3>Building</h3>
        <p><em>Detailed information not available</em></p>
        <p><strong>OSM ID:</strong> ${elementId}</p>
        <p><strong>Height:</strong> ${height}m</p>
        <p><strong>Location:</strong> ${lat.toFixed(5)}, ${lon.toFixed(5)}</p>
    `;
    
    infoPanel.style.display = 'block';
}

export function closeInfoPanel() {
    document.getElementById('info-panel').style.display = 'none';
}