import { CONFIG } from '../config.js';
import { MANUAL_BUILDING_LOOKUP } from './buildingLookup.js';

export let campusDataSource;
export let buildingMetadataMap = new Map();

export async function loadCampusMetadata() {
    console.log("📍 Loading metadata from GeoJSON...");
    
    const resource = await Cesium.IonResource.fromAssetId(CONFIG.CESIUM_ION_ASSETS.CAMPUS_DATA);
    campusDataSource = await Cesium.GeoJsonDataSource.load(resource, {
        stroke: Cesium.Color.TRANSPARENT,
        fill: Cesium.Color.TRANSPARENT,
        clampToGround: true
    });
    
    buildMetadataMap();
    console.log("✅ Metadata loaded!");
    console.log(`📊 ${buildingMetadataMap.size} buildings with metadata indexed`);
}

function buildMetadataMap() {
    const entities = campusDataSource.entities.values;
    
    entities.forEach(entity => {
        if (!entity.properties || !entity.properties.building) return;
        
        const osmId = entity.properties['@id']?._value;
        
        if (osmId) {
            const match = osmId.match(/(?:way|relation)\/(\d+)/);
            if (match) {
                const elementId = parseInt(match[1]);
                buildingMetadataMap.set(elementId, entity);
                
                const buildingNum = entity.properties['addr:housenumber']?._value;
                const name = entity.properties.name?._value;
                
                if (buildingNum || name) {
                    console.log(`Indexed: Element ${elementId} → Building ${buildingNum || 'unnamed'} (${name || ''})`);
                }
            }
        }
    });
}

export function getBuildingMetadata(elementId) {
    return buildingMetadataMap.get(elementId);
}

export function getManualBuildingData(elementId) {
    return MANUAL_BUILDING_LOOKUP[elementId] || null;
}

export function searchBuildings(term) {
    const matches = [];

    for (let [elementId, entity] of buildingMetadataMap) {
        const props = entity.properties;
        const houseNumber = props['addr:housenumber']?._value || '';
        const name = props.name?._value || '';
        const houseName = props['addr:housename']?._value || '';

        if (houseNumber.toLowerCase().includes(term) ||
            name.toLowerCase().includes(term) ||
            houseName.toLowerCase().includes(term)) {

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
                const c = CONFIG.CAMPUS_BOUNDARY.coords;
                if (lon < c[0] || lon > c[2] || lat < c[7] || lat > c[1]) continue;

                const buildingNum = houseNumber || 'Unknown';
                const buildingName = houseName || name || '';
                const fullName = buildingNum !== 'Unknown' ? `Building ${buildingNum}` : buildingName;
                const exact = houseNumber.toLowerCase() === term;

                matches.push({ entity, lat, lon, buildingNum, buildingName, fullName, exact });
            }
        }
    }

    matches.sort((a, b) => {
        if (a.exact !== b.exact) return a.exact ? -1 : 1;
        return a.buildingNum.localeCompare(b.buildingNum, undefined, { numeric: true });
    });

    const seen = new Set();
    return matches.filter(m => {
        const key = m.buildingNum !== 'Unknown' ? m.buildingNum : `${m.lat.toFixed(5)},${m.lon.toFixed(5)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
