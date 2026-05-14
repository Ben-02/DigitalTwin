import { initializeViewer, scheduleRender } from './map/viewer.js';
import { loadOSMBuildings, removeHighlight } from './map/buildings.js';
import { drawCampusBoundary } from './map/boundary.js';
import { loadCampusMetadata } from './data/metadata.js';
import { analyzePathwayData } from './data/pathways.js';
import { buildPathwayGraph } from './navigation/pathGraph.js';
import { getUserLocation } from './map/userLocation.js';
import { enableBuildingClick } from './ui/events.js';
import { searchBuilding } from './ui/search.js';
import { flyToCampus } from './map/camera.js';
import { closeInfoPanel } from './ui/infoPanel.js';
import { drawRouteTo } from './navigation/pathfinder.js';

async function initializeApp() {
    try {
        console.log("🚀 Initializing app...");
        
        initializeViewer();
        await loadOSMBuildings();
        await loadCampusMetadata();
        
        const pathways = analyzePathwayData();
        console.log(`Pathways analyzed: ${pathways.length}`);
        
        const graph = buildPathwayGraph();
        if (!graph) {
            console.error("⚠️ Failed to build pathway graph");
        }
        
        await getUserLocation();
        
        drawCampusBoundary();
        flyToCampus();
        enableBuildingClick();
        setupUIEventListeners();

        scheduleRender();
        import('./navigation/tripMode.js').catch(() => {});
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
            searchButton.textContent = 'Searching...';
            searchButton.style.background = '#95a5a6';
            searchButton.disabled = true;

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    searchBuilding();
                    searchButton.textContent = 'Search';
                    searchButton.style.background = '#ff6600';
                    searchButton.disabled = false;
                });
            });
        });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchButton.textContent = 'Searching...';
                searchButton.style.background = '#95a5a6';
                searchButton.disabled = true;

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        searchBuilding();
                        searchButton.textContent = 'Search';
                        searchButton.style.background = '#ff6600';
                        searchButton.disabled = false;
                    });
                });
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

    if (document.readyState === 'loading') 
    {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } 
    else 
    {
        initializeApp();

    }