export const CONFIG = {
    CESIUM_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2NjA3Mzc5Ny1hM2UzLTQ2ZGMtYWNkZC0xZmYxZDUyY2ZkMmMiLCJpZCI6MzUwNDE4LCJpYXQiOjE3NzYzNDkzMTd9.aEdahEnjSR7mEBfh3xzeCpOPqypUM572sWMD3bV_Vt0',
    
    CESIUM_ION_ASSETS: {
        CAMPUS_DATA: 3911682
    },
    
    CAMPUS_BOUNDARY: {
        coords: [
            115.88200, -31.99050,  // Northwest (Hayman Road + Kent Street)
            115.90020, -31.99050,  // Northeast (Hayman Road + Brand Drive)
            115.90020, -32.01350,  // Southeast (Manning Road + Brand Drive)
            115.88200, -32.01350,  // Southwest (Manning Road + Kent Street)
            115.88200, -31.99050   // Close loop
        ]
    },
    
    CAMERA: {
        DEFAULT_DISTANCE: 250,
        DEFAULT_PITCH: -35,
        DEFAULT_HEADING: 0
    }
};