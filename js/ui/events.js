import { viewer } from '../map/viewer.js';
import { highlightBuilding, removeHighlight } from '../map/buildings.js';
import { flyToBuilding } from '../map/camera.js';
import { showBuildingInfoWithDirections, showGenericBuildingInfo, showManualBuildingInfo, closeInfoPanel } from './infoPanel.js';
import { getBuildingMetadata, getManualBuildingData } from '../data/metadata.js';

let buildingClickHandler = null;

window.buildingClickEnabled = true;

export function enableBuildingClick() {
    buildingClickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    buildingClickHandler.setInputAction(function(click) {
        if (!window.buildingClickEnabled) return;
        
        const picked = viewer.scene.pick(click.position);
        
        if (Cesium.defined(picked) && picked instanceof Cesium.Cesium3DTileFeature) {
            highlightBuilding(picked);

            const elementId = picked.getProperty('elementId');
            const lat = picked.getProperty('cesium#latitude');
            const lon = picked.getProperty('cesium#longitude');
            const height = picked.getProperty('cesium#estimatedHeight');

            const metadataEntity = getBuildingMetadata(elementId);

            if (metadataEntity) {
                const buildingNum = metadataEntity.properties['addr:housenumber']?._value || 'Unknown';
                const buildingName = metadataEntity.properties['addr:housename']?._value ||
                                    metadataEntity.properties.name?._value || '';
                const fullName = buildingNum !== 'Unknown' ? `Building ${buildingNum}` : buildingName;

                showBuildingInfoWithDirections(metadataEntity, lat, lon, fullName);
            } else {
                const manualData = getManualBuildingData(elementId);
                if (manualData && (manualData.number || manualData.name)) {
                    showManualBuildingInfo(manualData, lat, lon);
                } else {
                    showGenericBuildingInfo(elementId, lat, lon, height);
                }
            }
            
            flyToBuilding(lat, lon, height);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}