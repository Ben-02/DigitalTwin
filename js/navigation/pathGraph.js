import { pathwayData } from '../data/pathways.js';

let pathwayGraph = null;
let nodeById = new Map(); // ← O(1) lookup by ID instead of Array.from().find()

export function buildPathwayGraph() {
    console.log("🔨 Building pathway graph...");
    
    if (!pathwayData || pathwayData.length === 0) {
        console.error("❌ No pathway data available!");
        return null;
    }
    
    const nodes = new Map();
    nodeById = new Map();
    const edges = [];
    let nodeIdCounter = 0;
    
    function coordKey(lat, lon) {
        return `${lat.toFixed(6)},${lon.toFixed(6)}`;
    }
    
    function getOrCreateNode(lat, lon) {
        const key = coordKey(lat, lon);
        if (!nodes.has(key)) {
            const node = {
                id: nodeIdCounter++,
                latitude: lat,
                longitude: lon,
                key: key,
                connections: []
            };
            nodes.set(key, node);
            nodeById.set(node.id, node); // ← Index by ID for fast lookup
        }
        return nodes.get(key);
    }
    
    pathwayData.forEach(pathway => {
        const entity = pathway.entity;
        if (entity.polyline && entity.polyline.positions) {
            const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
            
            const pathPoints = positions.map(position => {
                const cartographic = Cesium.Cartographic.fromCartesian(position);
                return {
                    latitude: Cesium.Math.toDegrees(cartographic.latitude),
                    longitude: Cesium.Math.toDegrees(cartographic.longitude)
                };
            });
            
            for (let i = 0; i < pathPoints.length - 1; i++) {
                const node1 = getOrCreateNode(pathPoints[i].latitude, pathPoints[i].longitude);
                const node2 = getOrCreateNode(pathPoints[i+1].latitude, pathPoints[i+1].longitude);
                
                const distance = calculateDistance(
                    pathPoints[i].latitude, pathPoints[i].longitude,
                    pathPoints[i+1].latitude, pathPoints[i+1].longitude
                );
                
                edges.push({ from: node1.id, to: node2.id, distance });
                
                if (!node1.connections.some(c => c.nodeId === node2.id)) {
                    node1.connections.push({ nodeId: node2.id, distance });
                }
                if (!node2.connections.some(c => c.nodeId === node1.id)) {
                    node2.connections.push({ nodeId: node1.id, distance });
                }
            }
        }
    });
    
    pathwayGraph = {
        nodes,
        edges,
        nodeCount: nodes.size,
        edgeCount: edges.length
    };
    
    console.log(`✅ Pathway graph built: ${pathwayGraph.nodeCount} nodes, ${pathwayGraph.edgeCount} edges`);
    return pathwayGraph;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) ** 2 +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function findNearestNode(lat, lon) {
    if (!pathwayGraph) return null;
    
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

// ===== OPTIMIZED A* =====
export function findPath(startNode, endNode) {
    if (!pathwayGraph) return null;
    
    console.log(`🔍 Finding path: node ${startNode.id} → node ${endNode.id}`);
    
    const gScore = new Map();
    const cameFrom = new Map();
    const closedSet = new Set();
    const openSet = new MinHeap();
    
    // Lazy initialization - only set scores when needed
    gScore.set(startNode.id, 0);
    openSet.push({ id: startNode.id, f: heuristic(startNode, endNode) });
    
    while (!openSet.isEmpty()) {
        const { id: current } = openSet.pop();
        
        // Skip if already processed
        if (closedSet.has(current)) continue;
        closedSet.add(current);
        
        // Reached destination!
        if (current === endNode.id) {
            console.log("✅ Path found!");
            return reconstructPath(cameFrom, current);
        }
        
        // O(1) lookup - no more Array.from().find()!
        const currentNode = nodeById.get(current);
        if (!currentNode) continue;
        
        const currentG = gScore.get(current) ?? Infinity;
        
        currentNode.connections.forEach(connection => {
            const neighborId = connection.nodeId;
            if (closedSet.has(neighborId)) return;
            
            const tentativeG = currentG + connection.distance;
            const neighborG = gScore.get(neighborId) ?? Infinity;
            
            if (tentativeG < neighborG) {
                // O(1) lookup for neighbor!
                const neighborNode = nodeById.get(neighborId);
                if (!neighborNode) return;
                
                cameFrom.set(neighborId, current);
                gScore.set(neighborId, tentativeG);
                openSet.push({
                    id: neighborId,
                    f: tentativeG + heuristic(neighborNode, endNode)
                });
            }
        });
    }
    
    console.log("❌ No path found");
    return null;
}

// ===== MIN HEAP (Priority Queue for A*) =====
// O(log n) push/pop vs O(n) iteration through Set
class MinHeap {
    constructor() { this.heap = []; }
    
    push(item) {
        this.heap.push(item);
        this._bubbleUp(this.heap.length - 1);
    }
    
    pop() {
        const top = this.heap[0];
        const last = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this._sinkDown(0);
        }
        return top;
    }
    
    isEmpty() { return this.heap.length === 0; }
    
    _bubbleUp(i) {
        while (i > 0) {
            const parent = Math.floor((i - 1) / 2);
            if (this.heap[parent].f <= this.heap[i].f) break;
            [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
            i = parent;
        }
    }
    
    _sinkDown(i) {
        const n = this.heap.length;
        while (true) {
            let smallest = i;
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            if (left < n && this.heap[left].f < this.heap[smallest].f) smallest = left;
            if (right < n && this.heap[right].f < this.heap[smallest].f) smallest = right;
            if (smallest === i) break;
            [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
            i = smallest;
        }
    }
}

function heuristic(node1, node2) {
    return calculateDistance(
        node1.latitude, node1.longitude,
        node2.latitude, node2.longitude
    );
}

function reconstructPath(cameFrom, current) {
    const path = [current];
    while (cameFrom.has(current)) {
        current = cameFrom.get(current);
        path.unshift(current);
    }
    return path;
}

export function getPathwayGraph() { return pathwayGraph; }