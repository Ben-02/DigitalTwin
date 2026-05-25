import { CONFIG } from '../config.js';
import { MANUAL_BUILDING_LOOKUP } from './buildingLookup.js';

export let campusDataSource;
export let buildingMetadataMap = new Map();

export async function loadCampusMetadata() {
    const resource = await Cesium.IonResource.fromAssetId(CONFIG.CESIUM_ION_ASSETS.CAMPUS_DATA);
    campusDataSource = await Cesium.GeoJsonDataSource.load(resource, {
        stroke: Cesium.Color.TRANSPARENT,
        fill: Cesium.Color.TRANSPARENT,
        clampToGround: true
    });
    
    buildMetadataMap();
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

function getEntityPosition(entity) {
    if (entity.position) {
        const pos = entity.position.getValue(Cesium.JulianDate.now());
        const carto = Cesium.Cartographic.fromCartesian(pos);
        return { lat: Cesium.Math.toDegrees(carto.latitude), lon: Cesium.Math.toDegrees(carto.longitude) };
    }
    if (entity.polygon && entity.polygon.hierarchy) {
        const positions = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now()).positions;
        let sumX = 0, sumY = 0, sumZ = 0;
        positions.forEach(p => { sumX += p.x; sumY += p.y; sumZ += p.z; });
        const carto = Cesium.Cartographic.fromCartesian(
            new Cesium.Cartesian3(sumX / positions.length, sumY / positions.length, sumZ / positions.length)
        );
        return { lat: Cesium.Math.toDegrees(carto.latitude), lon: Cesium.Math.toDegrees(carto.longitude) };
    }
    return null;
}

export function searchBuildings(term) {
    const matches = [];
    const addedElements = new Set();
    const c = CONFIG.CAMPUS_BOUNDARY.coords;

    for (let [elementId, entity] of buildingMetadataMap) {
        const props = entity.properties;
        const houseNumber = props['addr:housenumber']?._value || '';
        const name = props.name?._value || '';
        const houseName = props['addr:housename']?._value || '';

        if (houseNumber.toLowerCase().includes(term) ||
            name.toLowerCase().includes(term) ||
            houseName.toLowerCase().includes(term)) {

            const pos = getEntityPosition(entity);
            if (!pos || pos.lon < c[0] || pos.lon > c[2] || pos.lat < c[7] || pos.lat > c[1]) continue;

            const buildingNum = houseNumber || 'Unknown';
            const buildingName = houseName || name || '';
            const fullName = buildingNum !== 'Unknown' ? `Building ${buildingNum}` : buildingName;
            const exact = houseNumber.toLowerCase() === term;

            matches.push({ entity, lat: pos.lat, lon: pos.lon, buildingNum, buildingName, fullName, exact });
            addedElements.add(elementId);
        }
    }

    for (const [idStr, data] of Object.entries(MANUAL_BUILDING_LOOKUP)) {
        const elementId = parseInt(idStr);
        if (addedElements.has(elementId)) continue;

        const number = data.number || '';
        const name = data.name || '';
        if (!number && !name) continue;

        if (number.toLowerCase().includes(term) ||
            name.toLowerCase().includes(term)) {

            const entity = buildingMetadataMap.get(elementId);
            if (!entity) continue;

            const pos = getEntityPosition(entity);
            if (!pos || pos.lon < c[0] || pos.lon > c[2] || pos.lat < c[7] || pos.lat > c[1]) continue;

            const buildingNum = number || 'Unknown';
            const buildingName = name || '';
            const fullName = buildingNum !== 'Unknown' ? `Building ${buildingNum}` : buildingName;
            const exact = number.toLowerCase() === term;

            matches.push({ entity, lat: pos.lat, lon: pos.lon, buildingNum, buildingName, fullName, exact });
            addedElements.add(elementId);
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
