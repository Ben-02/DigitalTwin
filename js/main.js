import { initializeViewer, viewer } from './map/viewer.js';
import { loadOSMBuildings, removeHighlight} from './map/buildings.js';
import { drawCampusBoundary } from './map/boundary.js';
import { loadCampusMetadata, campusDataSource } from './data/metadata.js';
import { analyzePathwayData } from './data/pathways.js';
import { buildPathwayGraph } from './navigation/pathGraph.js';
import { getUserLocation } from './map/userLocation.js';
import { enableBuildingClick } from './ui/events.js';
import { searchBuilding } from './ui/search.js';
import { flyToCampus } from './map/camera.js';
import { closeInfoPanel } from './ui/infoPanel.js';

async function initializeApp() {
    try {
        console.log("🚀 Initializing app...");
        
        initializeViewer();
        await loadOSMBuildings();
        await loadCampusMetadata();
        
        // Analyze pathways FIRST
        const pathways = analyzePathwayData();
        console.log(`Pathways analyzed: ${pathways.length}`);
        
        // then build the graph
        const graph = buildPathwayGraph();
        if (!graph) {
            console.error("⚠️ Failed to build pathway graph - pathfinding will not work");
        }
        
        await getUserLocation();
        
        drawCampusBoundary();
        flyToCampus();
        enableBuildingClick();
        setupUIEventListeners();
        
        viewer.scene.requestRender();
        console.log("🎉 Campus loaded successfully!");
        
    } catch (error) {
        console.error("❌ Error loading campus:", error);
    }
}

function setupUIEventListeners() {
    console.log("🔌 Setting up UI event listeners...");
    
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            console.log("Search button clicked");
            searchBuilding();
        });
    }
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchBuilding();
            }
        });
    }
    
    const closeButton = document.getElementById('closeButton');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            closeInfoPanel();
            removeHighlight();
        });
    }
    
    console.log("✅ UI event listeners setup complete");
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

const pathways = analyzePathwayData();
console.log(`Pathways analyzed: ${pathways.length}`);

// ADD THESE DEBUG LOGS:
if (pathways.length === 0) {
    console.error('❌ CRITICAL: pathwayData is empty on this browser!');
    console.log('campusDataSource exists:', !!campusDataSource);
} else {
    console.log('✅ pathwayData populated correctly');
}

const graph = buildPathwayGraph();
if (graph) {
    console.log(`✅ Graph: ${graph.nodeCount} nodes, ${graph.edgeCount} edges`);
} else {
    console.error('❌ CRITICAL: Graph failed to build!');
}