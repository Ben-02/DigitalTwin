import { campusDataSource } from './metadata.js';

export let pathwayData = [];

export function analyzePathwayData() {
    if (!campusDataSource) return [];

    const entities = campusDataSource.entities.values;
    pathwayData.length = 0;
    
    entities.forEach(entity => {
        if (!entity.properties) return;
        
        const props = entity.properties;
        const highway = props.highway?._value;
        
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
    
    return pathwayData;
}