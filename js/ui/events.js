import { viewer } from '../map/viewer.js';
import { highlightBuilding, removeHighlight } from '../map/buildings.js';
import { flyToBuilding } from '../map/camera.js';
import { showBuildingInfoWithDirections, showGenericBuildingInfo, showManualBuildingInfo, closeInfoPanel } from './infoPanel.js';
import { getBuildingMetadata, getManualBuildingData } from '../data/metadata.js';
// ← Removed drawRouteTo import

let buildingClickHandler = null;

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
                
                const buildingNum = metadataEntity.properties['addr:housenumber']?._value || 'Unknown';
                const buildingName = metadataEntity.properties['addr:housename']?._value || 
                                    metadataEntity.properties.name?._value || '';
                const fullName = buildingNum !== 'Unknown' ? `Building ${buildingNum}` : buildingName;
                
                // Show info + Get Directions button (no auto-route!)
                showBuildingInfoWithDirections(metadataEntity, lat, lon, fullName);
                
            } else {
                console.log("⚠️ No metadata available for element ID:", elementId);
                
                // Try manual lookup before showing generic info
                const manualData = getManualBuildingData(elementId);
                if (manualData && (manualData.number || manualData.name)) {
                    console.log(`✅ Found manual data for ${elementId}`);
                    showManualBuildingInfo(manualData, lat, lon);
                } else {
                    showGenericBuildingInfo(elementId, lat, lon, height);
                }
            }
            
            flyToBuilding(lat, lon, height);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    console.log("✅ Building click handler initialized");
}