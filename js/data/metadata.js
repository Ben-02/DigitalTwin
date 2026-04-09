import { CONFIG } from '../config.js';

export let campusDataSource;
export let buildingMetadataMap = new Map();

export async function loadCampusMetadata() 
{
    console.log("📍 Loading metadata from GeoJSON...");
    
    const resource = await Cesium.IonResource.fromAssetId(CONFIG.CESIUM_ION_ASSETS.CAMPUS_DATA);
    campusDataSource = await Cesium.GeoJsonDataSource.load(resource, 
        {
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
            const match = osmId.match(/way\/(\d+)/);
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