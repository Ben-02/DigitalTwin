import { pathwayData } from '../data/pathways.js';

let pathwayGraph = null;

// Build a graph of pathway connections
export function buildPathwayGraph() {
    console.log("🔨 Building pathway graph...");
    
    if (!pathwayData || pathwayData.length === 0) {
        console.error("❌ No pathway data available! Cannot build graph.");
        return null;
    }
    
    console.log(`Using ${pathwayData.length} pathways to build graph...`);
    
    const nodes = new Map();
    const edges = [];
    
    let nodeIdCounter = 0;
    
    // Function to create a unique key for a coordinate
    function coordKey(lat, lon) {
        return `${lat.toFixed(6)},${lon.toFixed(6)}`;
    }
    
    // Function to get or create a node
    function getOrCreateNode(lat, lon) {
        const key = coordKey(lat, lon);
        
        if (!nodes.has(key)) {
            nodes.set(key, {
                id: nodeIdCounter++,
                latitude: lat,
                longitude: lon,
                key: key,
                connections: []
            });
        }
        
        return nodes.get(key);
    }
    
    // Process each pathway to build nodes and edges
    pathwayData.forEach(pathway => {
        const entity = pathway.entity;
        
        if (entity.polyline && entity.polyline.positions) {
            const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
            
            // Convert positions to lat/lon
            const pathPoints = positions.map(position => {
                const cartographic = Cesium.Cartographic.fromCartesian(position);
                return {
                    latitude: Cesium.Math.toDegrees(cartographic.latitude),
                    longitude: Cesium.Math.toDegrees(cartographic.longitude)
                };
            });
            
            // Create nodes and edges for this pathway
            for (let i = 0; i < pathPoints.length - 1; i++) {
                const point1 = pathPoints[i];
                const point2 = pathPoints[i + 1];
                
                const node1 = getOrCreateNode(point1.latitude, point1.longitude);
                const node2 = getOrCreateNode(point2.latitude, point2.longitude);
                
                // Calculate distance between nodes
                const distance = calculateDistance(
                    point1.latitude, point1.longitude,
                    point2.latitude, point2.longitude
                );
                
                // Create bidirectional edge
                const edge = {
                    from: node1.id,
                    to: node2.id,
                    distance: distance,
                    pathway: pathway
                };
                
                edges.push(edge);
                
                // Add connections to nodes
                if (!node1.connections.some(c => c.nodeId === node2.id)) {
                    node1.connections.push({ nodeId: node2.id, distance: distance });
                }
                if (!node2.connections.some(c => c.nodeId === node1.id)) {
                    node2.connections.push({ nodeId: node1.id, distance: distance });
                }
            }
        }
    });
    
    pathwayGraph = {
        nodes: nodes,
        edges: edges,
        nodeCount: nodes.size,
        edgeCount: edges.length
    };
    
    console.log(`✅ Pathway graph built: ${pathwayGraph.nodeCount} nodes, ${pathwayGraph.edgeCount} edges`);
    
    return pathwayGraph;
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// Find nearest node to a location
export function findNearestNode(lat, lon) {
    if (!pathwayGraph) {
        console.error("Pathway graph not built yet!");
        return null;
    }
    
    let nearestNode = null;
    let minDistance = Infinity;
    
    pathwayGraph.nodes.forEach(node => {
        const distance = calculateDistance(lat, lon, node.latitude, node.longitude);
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestNode = node;
        }
    });
    
    return { node: nearestNode, distance: minDistance };
}

// Simple A* pathfinding algorithm
export function findPath(startNode, endNode) {
    if (!pathwayGraph) return null;
    
    console.log(`🔍 Finding path from node ${startNode.id} to node ${endNode.id}...`);
    
    const openSet = new Set([startNode.id]);
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    // Initialize scores
    pathwayGraph.nodes.forEach(node => {
        gScore.set(node.id, Infinity);
        fScore.set(node.id, Infinity);
    });
    
    gScore.set(startNode.id, 0);
    fScore.set(startNode.id, heuristic(startNode, endNode));
    
    while (openSet.size > 0) {
        // Find node in openSet with lowest fScore
        let current = null;
        let lowestF = Infinity;
        
        openSet.forEach(nodeId => {
            const f = fScore.get(nodeId);
            if (f < lowestF) {
                lowestF = f;
                current = nodeId;
            }
        });
        
        // Get current node
        const currentNode = Array.from(pathwayGraph.nodes.values()).find(n => n.id === current);
        
        // Check if reached the goal
        if (current === endNode.id) {
            console.log("✅ Path found!");
            return reconstructPath(cameFrom, current);
        }
        
        openSet.delete(current);
        
        // Check all neighbours
        currentNode.connections.forEach(connection => {
            const neighborId = connection.nodeId;
            const tentativeGScore = gScore.get(current) + connection.distance;
            
            if (tentativeGScore < gScore.get(neighborId)) {
                const neighborNode = Array.from(pathwayGraph.nodes.values()).find(n => n.id === neighborId);
                
                cameFrom.set(neighborId, current);
                gScore.set(neighborId, tentativeGScore);
                fScore.set(neighborId, tentativeGScore + heuristic(neighborNode, endNode));
                
                openSet.add(neighborId);
            }
        });
    }
    
    console.log("❌ No path found");
    return null; // No path found
}

// Heuristic function (straight-line distance)
function heuristic(node1, node2) {
    return calculateDistance(
        node1.latitude, node1.longitude,
        node2.latitude, node2.longitude
    );
}

// Reconstruct path from A* result
function reconstructPath(cameFrom, current) {
    const path = [current];
    
    while (cameFrom.has(current)) {
        current = cameFrom.get(current);
        path.unshift(current);
    }
    
    return path;
}

export function getPathwayGraph() {
    return pathwayGraph;
}