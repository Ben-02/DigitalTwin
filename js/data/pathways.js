import { campusDataSource } from './metadata.js';

export let pathwayData = [];

export function analyzePathwayData() {
    if (!campusDataSource) {
        console.log("Campus data not loaded yet");
        return [];
    }
    
    const entities = campusDataSource.entities.values;
    pathwayData = []; // Reset
    
    console.log("🔍 Analyzing GeoJSON for pathway data...");
    
    entities.forEach(entity => {
        if (!entity.properties) return;
        
        const props = entity.properties;
        const highway = props.highway?._value;
        
        // Check if this is a pathway/road
        if (highway) {
            const pathway = {
                type: highway,
                name: props.name?._value || 'Unnamed',
                surface: props.surface?._value,
                lit: props.lit?._value,
                width: props.width?._value,
                entity: entity
            };
            
            pathwayData.push(pathway);
        }
    });
    
    console.log(`📊 Total pathways found: ${pathwayData.length}`);
    
    // Group by type
    const byType = {};
    pathwayData.forEach(p => {
        byType[p.type] = (byType[p.type] || 0) + 1;
    });
    
    console.log("Pathway types:", byType);
    
    return pathwayData; // Make sure to return it
}