Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3ZGFkNTM3YS03OGEwLTQwNjktYjIwNi0wYTg3Y2Q1MTRjNmEiLCJpZCI6MzUwNDE4LCJpYXQiOjE3NzI1MDA0NzV9.bas8Zj1cGmti9iIqMm2lYpdSmx7PXbfyldE1nIKUePc';

let campusDataSource;
let buildingMetadataMap = new Map();
let highlightedFeature = null;

const viewer = new Cesium.Viewer('cesiumContainer', {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: true,
    sceneModePicker: false,
    navigationHelpButton: true,
    infoBox: false,
    selectionIndicator: false
});

async function loadCampus() {
    try {
        console.log("🏗️ Loading Cesium OSM Buildings (3D Tiles)...");
        
        const osmBuildings = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(osmBuildings);
        
        console.log("✅ 3D buildings loaded!");
        
        console.log("📍 Loading metadata from GeoJSON...");
        
        const resource = await Cesium.IonResource.fromAssetId(3911682);
        campusDataSource = await Cesium.GeoJsonDataSource.load(resource, {
            stroke: Cesium.Color.TRANSPARENT,
            fill: Cesium.Color.TRANSPARENT,
            clampToGround: true
        });
        
        // Don't add to viewer - just use as metadata source
        // viewer.dataSources.add(campusDataSource);
        
        buildMetadataMap();
        
        console.log("✅ Metadata loaded!");
        console.log(`📊 ${buildingMetadataMap.size} buildings with metadata indexed`);
        
        // Draw manual campus boundary
        drawManualBoundary();
        
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(115.8945, -32.0063, 800),
            orientation: {
                heading: 0,
                pitch: Cesium.Math.toRadians(-45),
            },
            duration: 3
        });
        
        enableBuildingClick();
        
        console.log("🎉 Campus loaded successfully!");
        
    } catch (error) {
        console.error("❌ Error loading campus:", error);
    }
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

function drawManualBoundary() {
    console.log("📐 Drawing campus boundary...");
    
    // Expanded boundary to cover entire Curtin Bentley campus
    const boundaryCoords = [
        115.88900, -31.99900,  // Northwest corner (expanded)
        115.90000, -31.99900,  // Northeast corner (expanded)
        115.90000, -32.01100,  // Southeast corner (expanded)
        115.88900, -32.01100,  // Southwest corner (expanded)
        115.88900, -31.99900,  // Back to northwest to close the loop
    ];
    
    // Draw as a polyline (just the outline, no fill)
    viewer.entities.add({
        name: 'Curtin Bentley Campus Boundary',
        polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(boundaryCoords),
            width: 6,
            material: Cesium.Color.ORANGE,
            clampToGround: true
        }
    });
    
    console.log("✅ Campus boundary drawn");
}

function enableBuildingClick() {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    handler.setInputAction(function(click) {
        const picked = viewer.scene.pick(click.position);
        
        if (Cesium.defined(picked) && picked instanceof Cesium.Cesium3DTileFeature) {
            console.log("=== Building Clicked ===");
            
            if (highlightedFeature) {
                highlightedFeature.color = Cesium.Color.WHITE;
            }
            
            highlightedFeature = picked;
            picked.color = Cesium.Color.CYAN.withAlpha(0.8);
            
            const elementId = picked.getProperty('elementId');
            const lat = picked.getProperty('cesium#latitude');
            const lon = picked.getProperty('cesium#longitude');
            const height = picked.getProperty('cesium#estimatedHeight');
            
            console.log(`Element ID: ${elementId}`);
            console.log(`Position: ${lat}, ${lon}`);
            console.log(`Height: ${height}m`);
            
            const metadataEntity = buildingMetadataMap.get(elementId);
            
            if (metadataEntity) {
                console.log("✅ Found metadata for this building!");
                showBuildingInfo(metadataEntity, picked);
            } else {
                console.log("⚠️ No metadata available for element ID:", elementId);
                showGenericBuildingInfo(elementId, lat, lon, height);
            }
            
            flyToBuilding(lat, lon, height);
            
            setTimeout(() => {
                if (highlightedFeature === picked) {
                    picked.color = Cesium.Color.WHITE;
                    highlightedFeature = null;
                }
            }, 3000);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

function showBuildingInfo(entity, tileFeature) {
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

function showGenericBuildingInfo(elementId, lat, lon, height) {
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

function flyToBuilding(lat, lon, buildingHeight = 10) {
    const targetPosition = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
    
    const distance = 250;
    const pitch = -35;
    const heading = 0;
    
    const boundingSphere = new Cesium.BoundingSphere(
        targetPosition,
        buildingHeight / 2
    );
    
    const headingRadians = Cesium.Math.toRadians(heading);
    const pitchRadians = Cesium.Math.toRadians(pitch);
    
    const offset = new Cesium.HeadingPitchRange(
        headingRadians,
        pitchRadians,
        distance
    );
    
    viewer.camera.flyToBoundingSphere(boundingSphere, {
        duration: 2.0,
        offset: offset
    });
}

function closeInfoPanel() {
    document.getElementById('info-panel').style.display = 'none';
    
    if (highlightedFeature) {
        highlightedFeature.color = Cesium.Color.WHITE;
        highlightedFeature = null;
    }
}

function searchBuilding() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    
    if (!searchTerm) {
        alert('Please enter a building number or name');
        return;
    }
    
    console.log(`🔍 Searching for: "${searchTerm}"`);
    
    if (highlightedFeature) {
        highlightedFeature.color = Cesium.Color.WHITE;
        highlightedFeature = null;
    }
    
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
                flyToBuilding(lat, lon, 15);
                showBuildingInfo(entity, null);
                
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
            highlightedFeature = picked;
            picked.color = Cesium.Color.CYAN.withAlpha(0.8);
            
            console.log("✅ Building highlighted after search");
            
            setTimeout(() => {
                if (highlightedFeature === picked) {
                    picked.color = Cesium.Color.WHITE;
                    highlightedFeature = null;
                }
            }, 3000);
        }
    }
}

loadCampus();