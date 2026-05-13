import { buildingMetadataMap } from '../data/metadata.js';
import { showBuildingInfoWithDirections } from './infoPanel.js';
import { flyToBuilding } from '../map/camera.js';
import { viewer } from '../map/viewer.js';
import { removeHighlight } from '../map/buildings.js';

let lastSearchMatches = [];

export function searchBuilding() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();

    if (!searchTerm) {
        alert('Please enter a building number or name');
        return;
    }

    console.log(`🔍 Searching for: "${searchTerm}"`);
    removeHighlight();

    const matches = [];

    for (let [elementId, entity] of buildingMetadataMap) {
        const props = entity.properties;
        const houseNumber = props['addr:housenumber']?._value || '';
        const name = props.name?._value || '';
        const houseName = props['addr:housename']?._value || '';

        if (houseNumber.toLowerCase().includes(searchTerm) ||
            name.toLowerCase().includes(searchTerm) ||
            houseName.toLowerCase().includes(searchTerm)) {

            let lat, lon;

            if (entity.position) {
                const position = entity.position.getValue(Cesium.JulianDate.now());
                const cartographic = Cesium.Cartographic.fromCartesian(position);
                lat = Cesium.Math.toDegrees(cartographic.latitude);
                lon = Cesium.Math.toDegrees(cartographic.longitude);
            } else if (entity.polygon && entity.polygon.hierarchy) {
                const hierarchy = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
                const positions = hierarchy.positions;

                let sumX = 0, sumY = 0, sumZ = 0;
                positions.forEach(pos => {
                    sumX += pos.x;
                    sumY += pos.y;
                    sumZ += pos.z;
                });

                const centerPos = new Cesium.Cartesian3(
                    sumX / positions.length,
                    sumY / positions.length,
                    sumZ / positions.length
                );

                const cartographic = Cesium.Cartographic.fromCartesian(centerPos);
                lat = Cesium.Math.toDegrees(cartographic.latitude);
                lon = Cesium.Math.toDegrees(cartographic.longitude);
            }

            if (lat && lon) {
                const buildingNum = houseNumber || 'Unknown';
                const buildingName = houseName || name || '';
                const fullName = buildingNum !== 'Unknown' ? `Building ${buildingNum}` : buildingName;
                const exact = houseNumber.toLowerCase() === searchTerm;

                matches.push({ entity, lat, lon, buildingNum, buildingName, fullName, exact });
            }
        }
    }

    if (matches.length === 0) {
        alert(`No building found matching "${searchTerm}"`);
        return;
    }

    matches.sort((a, b) => {
        if (a.exact !== b.exact) return a.exact ? -1 : 1;
        return a.buildingNum.localeCompare(b.buildingNum, undefined, { numeric: true });
    });

    const seen = new Set();
    const unique = matches.filter(m => {
        const key = m.buildingNum !== 'Unknown' ? m.buildingNum : `${m.lat.toFixed(5)},${m.lon.toFixed(5)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    if (unique.length === 1) {
        selectResult(unique[0]);
    } else {
        showResultList(unique, searchTerm);
    }
}

function selectResult(match) {
    flyToBuilding(match.lat, match.lon, 15);
    showBuildingInfoWithDirections(match.entity, match.lat, match.lon, match.fullName);
    setTimeout(() => {
        tryHighlightBuildingAtPosition(match.lat, match.lon);
    }, 2500);
}

function showResultList(matches, searchTerm) {
    lastSearchMatches = matches;

    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');

    let html = `<h3>Results for "${searchTerm}"</h3>`;
    html += `<p style="color:#666; font-size:13px; margin:0 0 10px;">${matches.length} buildings found</p>`;

    matches.forEach((match, index) => {
        const showSubtext = match.buildingName && match.buildingNum !== 'Unknown';
        html += `
            <div style="padding:10px; margin:6px 0; background:#f8f8f8; border-radius:8px; cursor:pointer; border:1px solid #eee;"
                 onclick="window.selectSearchResult(${index})">
                <strong>${match.fullName}</strong>
                ${showSubtext ? `<br><span style="color:#666; font-size:13px;">${match.buildingName}</span>` : ''}
            </div>
        `;
    });

    infoContent.innerHTML = html;
    infoPanel.style.display = 'block';
}

function tryHighlightBuildingAtPosition(lat, lon) {
    const position = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
    const screenPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, position);

    if (screenPosition) {
        const picked = viewer.scene.pick(screenPosition);
        if (Cesium.defined(picked) && picked instanceof Cesium.Cesium3DTileFeature) {
            import('../map/buildings.js').then(({ highlightBuilding }) => {
                highlightBuilding(picked);
            });
            console.log("✅ Building highlighted after search");
        }
    }
}

window.selectSearchResult = function(index) {
    if (lastSearchMatches[index]) {
        selectResult(lastSearchMatches[index]);
    }
};
window.searchBuilding = searchBuilding;