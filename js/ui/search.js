import { searchBuildings } from '../data/metadata.js';
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

    removeHighlight();

    const results = searchBuildings(searchTerm);

    if (results.length === 0) {
        alert(`No building found matching "${searchTerm}"`);
        return;
    }

    if (results.length === 1) {
        selectResult(results[0]);
    } else {
        showResultList(results, searchTerm);
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
        }
    }
}

window.selectSearchResult = function(index) {
    if (lastSearchMatches[index]) {
        selectResult(lastSearchMatches[index]);
    }
};
window.searchBuilding = searchBuilding;