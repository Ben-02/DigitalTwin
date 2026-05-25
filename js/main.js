import { initializeViewer, scheduleRender } from './map/viewer.js';
import { loadOSMBuildings, removeHighlight } from './map/buildings.js';
import { drawCampusBoundary } from './map/boundary.js';
import { loadCampusMetadata } from './data/metadata.js';
import { analyzePathwayData } from './data/pathways.js';
import { buildPathwayGraph } from './navigation/pathGraph.js';
import { getUserLocation } from './map/userLocation.js';
import { enableBuildingClick } from './ui/events.js';
import { searchBuilding } from './ui/search.js';
import { closeInfoPanel } from './ui/infoPanel.js';

async function initializeApp() {
    try {
        initializeViewer();

        const gpsPromise = getUserLocation();

        await Promise.all([loadOSMBuildings(), loadCampusMetadata()]);

        const pathways = analyzePathwayData();

        const graph = buildPathwayGraph();
        if (!graph) {
            console.error("Failed to build pathway graph");
        }

        await gpsPromise;

        drawCampusBoundary();
        enableBuildingClick();
        setupUIEventListeners();

        scheduleRender();
        import('./navigation/tripMode.js').catch(() => {});
        hideLoadingScreen();

    } catch (error) {
        console.error("Error loading campus:", error);
        hideLoadingScreen();
    }
}

function hideLoadingScreen() {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 500);
}

function setupUIEventListeners() {

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
}

    if (document.readyState === 'loading') 
    {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } 
    else 
    {
        initializeApp();

    }