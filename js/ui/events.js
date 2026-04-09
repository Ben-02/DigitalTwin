import { viewer } from '../map/viewer.js';
import { highlightBuilding, removeHighlight } from '../map/buildings.js';
import { getBuildingMetadata } from '../data/metadata.js';
import { showBuildingInfo, showGenericBuildingInfo, closeInfoPanel } from './infoPanel.js';
import { flyToBuilding } from '../map/camera.js';
import { drawRouteTo } from '../navigation/pathfinder.js';

let buildingClickHandler = null;

// Make this a global variable that userLocation.js can access
window.buildingClickEnabled = true;

export function enableBuildingClick() {
    buildingClickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    buildingClickHandler.setInputAction(function(click) {
        if (!window.buildingClickEnabled) {
            console.log("Building clicks temporarily disabled");
            return;
        }
        
        const picked = viewer.scene.pick(click.position);
        
        if (Cesium.defined(picked) && picked instanceof Cesium.Cesium3DTileFeature) {
            console.log("=== Building Clicked ===");
            
            highlightBuilding(picked);
            
            const elementId = picked.getProperty('elementId');
            const lat = picked.getProperty('cesium#latitude');
            const lon = picked.getProperty('cesium#longitude');
            const height = picked.getProperty('cesium#estimatedHeight');
            
            console.log(`Element ID: ${elementId}`);
            console.log(`Position: ${lat}, ${lon}`);
            console.log(`Height: ${height}m`);
            
            const metadataEntity = getBuildingMetadata(elementId);
            
            if (metadataEntity) {
                console.log("✅ Found metadata for this building!");
                showBuildingInfo(metadataEntity);
                
                const buildingNum = metadataEntity.properties['addr:housenumber']?._value || 'Unknown';
                const buildingName = metadataEntity.properties['addr:housename']?._value || 
                                    metadataEntity.properties.name?._value || '';
                const fullName = buildingNum !== 'Unknown' ? `Building ${buildingNum}` : buildingName;
                drawRouteTo(lat, lon, fullName);
                
            } else {
                console.log("⚠️ No metadata available for element ID:", elementId);
                showGenericBuildingInfo(elementId, lat, lon, height);
                drawRouteTo(lat, lon, `Building (ID: ${elementId})`);
            }
            
            flyToBuilding(lat, lon, height);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    console.log("✅ Building click handler initialized");
}