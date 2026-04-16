// Configuration and constants
export const CONFIG = {
    CESIUM_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2NjA3Mzc5Ny1hM2UzLTQ2ZGMtYWNkZC0xZmYxZDUyY2ZkMmMiLCJpZCI6MzUwNDE4LCJpYXQiOjE3NzYzNDkzMTd9.aEdahEnjSR7mEBfh3xzeCpOPqypUM572sWMD3bV_Vt0',
    
    CESIUM_ION_ASSETS: {
        CAMPUS_DATA: 3911682
    },
    
    CAMPUS_CENTER: {
        longitude: 115.8945,
        latitude: -32.0063,
        height: 800
    },
    
    CAMPUS_BOUNDARY: {
        coords: [
            115.89100, -32.00100,  // Northwest
            115.89800, -32.00100,  // Northeast
            115.89800, -32.00900,  // Southeast
            115.89100, -32.00900,  // Southwest
            115.89100, -32.00100   // Close loop
        ]
    },
    
    CAMERA: {
        DEFAULT_DISTANCE: 250,
        DEFAULT_PITCH: -35,
        DEFAULT_HEADING: 0
    }
};