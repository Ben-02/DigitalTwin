import { buildingMetadataMap } from '../data/metadata.js';
import { showBuildingInfoWithDirections } from './infoPanel.js';
import { flyToBuilding } from '../map/camera.js';
import { viewer } from '../map/viewer.js';
import { removeHighlight } from '../map/buildings.js';

export function searchBuilding() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    
    if (!searchTerm) {
        alert('Please enter a building number or name');
        return;
    }
    
    console.log(`🔍 Searching for: "${searchTerm}"`);
    removeHighlight();
    
    let found = false;
    
    for (let [elementId, entity] of buildingMetadataMap) {
        const props = entity.properties;
        const houseNumber = props['addr:housenumber']?._value || '';
        const name = props.name?._value || '';
        const houseName = props['addr:housename']?._value || '';
        
        if (houseNumber.toLowerCase().includes(searchTerm) ||
            name.toLowerCase().includes(searchTerm) ||
            houseName.toLowerCase().includes(searchTerm)) {
            
            console.log(`✅ Found: Building ${houseNumber} - ${houseName || name}`);
            
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
                const buildingNum = props['addr:housenumber']?._value || 'Unknown';
                const buildingName = props['addr:housename']?._value || props.name?._value || '';
                const fullName = buildingNum !== 'Unknown' ? `Building ${buildingNum}` : buildingName;

                // Step 1: Zoom to building
                flyToBuilding(lat, lon, 15);

                // Step 2: Show info with Get Directions button (NO auto-route!)
                showBuildingInfoWithDirections(entity, lat, lon, fullName);
                
                setTimeout(() => {
                    tryHighlightBuildingAtPosition(lat, lon);
                }, 2500);
                
                found = true;
                break;
            }
        }
    }
    
    if (!found) {
        alert(`No building found matching "${searchTerm}"`);
    }
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

window.searchBuilding = searchBuilding;