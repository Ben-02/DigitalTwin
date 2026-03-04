import { initializeViewer } from './map/viewer.js';
import { loadOSMBuildings } from './map/buildings.js';
import { drawCampusBoundary } from './map/boundary.js';
import { loadCampusMetadata } from './data/metadata.js';
import { analyzePathwayData } from './data/pathways.js';
import { buildPathwayGraph } from './navigation/pathGraph.js';
import { getUserLocation } from './map/userLocation.js';
import { enableBuildingClick } from './ui/events.js';
import { searchBuilding } from './ui/search.js';
import { flyToCampus } from './map/camera.js';
import { closeInfoPanel } from './ui/infoPanel.js';
import { removeHighlight } from './map/buildings.js';

async function initializeApp() {
    try {
        console.log("🚀 Initializing app...");
        
        initializeViewer();
        await loadOSMBuildings();
        await loadCampusMetadata();
        
        // Analyze pathways FIRST
        const pathways = analyzePathwayData();
        console.log(`Pathways analyzed: ${pathways.length}`);
        
        // THEN build the graph
        const graph = buildPathwayGraph();
        if (!graph) {
            console.error("⚠️ Failed to build pathway graph - pathfinding will not work");
        }
        
        await getUserLocation();
        
        drawCampusBoundary();
        flyToCampus();
        enableBuildingClick();
        setupUIEventListeners();
        
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