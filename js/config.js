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
    },

    NAVIGATION: {
        WALKING_SPEED: 80,
        OFF_ROUTE_THRESHOLD: 35,
        OFF_ROUTE_DELAY: 4000,
        ARRIVAL_THRESHOLD: 20,
        HEADING_MOVE_THRESHOLD: 3,
        CAMERA_FOLLOW_THRESHOLD: 5,
        TURN_ANGLE_THRESHOLD: 25,
        SHARP_TURN_THRESHOLD: 70,
        GPS_SMOOTHING_FACTOR: 0.7,
        GPS_ERROR_LIMIT: 3,
        ROUTE_SEARCH_WINDOW: 15,
        FULL_SCAN_THRESHOLD: 50
    },

    GPS: {
        ACCURACY_WARNING: 50
    }
};