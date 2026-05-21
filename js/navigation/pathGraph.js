import { pathwayData } from '../data/pathways.js';
import { calculateDistance } from '../utils/helper.js';

let pathwayGraph = null;
let nodeById = new Map();
let spatialGrid = null;
let gridConfig = null;

export function buildPathwayGraph() {
    console.log("🔨 Building pathway graph...");

    if (!pathwayData || pathwayData.length === 0) {
        console.error("❌ No pathway data available!");
        return null;
    }
    
    const nodes = new Map();
    nodeById = new Map();
    spatialGrid = null;
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
            nodeById.set(node.id, node);
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
    
    buildSpatialGrid();
    console.log(`✅ Pathway graph built: ${pathwayGraph.nodeCount} nodes, ${pathwayGraph.edgeCount} edges`);
    return pathwayGraph;
}

function buildSpatialGrid() {
    if (!pathwayGraph) return;

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    pathwayGraph.nodes.forEach(node => {
        if (node.latitude < minLat) minLat = node.latitude;
        if (node.latitude > maxLat) maxLat = node.latitude;
        if (node.longitude < minLon) minLon = node.longitude;
        if (node.longitude > maxLon) maxLon = node.longitude;
    });

    // ~50m cells (at latitude -32°: 0.00045° lat ≈ 50m, 0.00053° lon ≈ 50m)
    const cellLat = 0.00045;
    const cellLon = 0.00053;
    minLat -= cellLat;
    maxLat += cellLat;
    minLon -= cellLon;
    maxLon += cellLon;

    const rows = Math.ceil((maxLat - minLat) / cellLat);
    const cols = Math.ceil((maxLon - minLon) / cellLon);

    gridConfig = { minLat, minLon, cellLat, cellLon, rows, cols };
    spatialGrid = new Map();

    pathwayGraph.nodes.forEach(node => {
        const r = Math.floor((node.latitude - minLat) / cellLat);
        const c = Math.floor((node.longitude - minLon) / cellLon);
        const key = r * cols + c;
        if (!spatialGrid.has(key)) spatialGrid.set(key, []);
        spatialGrid.get(key).push(node);
    });
}

export function findNearestNode(lat, lon) {
    if (!pathwayGraph) return null;
    if (!spatialGrid) return findNearestNodeBruteForce(lat, lon);

    const row = Math.floor((lat - gridConfig.minLat) / gridConfig.cellLat);
    const col = Math.floor((lon - gridConfig.minLon) / gridConfig.cellLon);

    let nearestNode = null;
    let minDistance = Infinity;

    for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
            if (r < 0 || r >= gridConfig.rows || c < 0 || c >= gridConfig.cols) continue;
            const cell = spatialGrid.get(r * gridConfig.cols + c);
            if (!cell) continue;
            for (const node of cell) {
                const distance = calculateDistance(lat, lon, node.latitude, node.longitude);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestNode = node;
                }
            }
        }
    }

    if (!nearestNode) return findNearestNodeBruteForce(lat, lon);
    return { node: nearestNode, distance: minDistance };
}

function findNearestNodeBruteForce(lat, lon) {
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

export function findPath(startNode, endNode) {
    if (!pathwayGraph) return null;

    console.log(`🔍 Finding path: node ${startNode.id} → node ${endNode.id}`);
    
    const gScore = new Map();
    const cameFrom = new Map();
    const closedSet = new Set();
    const openSet = new MinHeap();
    
    gScore.set(startNode.id, 0);
    openSet.push({ id: startNode.id, f: heuristic(startNode, endNode) });
    
    while (!openSet.isEmpty()) {
        const { id: current } = openSet.pop();
        
        if (closedSet.has(current)) continue;
        closedSet.add(current);

        if (current === endNode.id) {
            console.log("✅ Path found!");
            return reconstructPath(cameFrom, current);
        }
        
        const currentNode = nodeById.get(current);
        if (!currentNode) continue;
        
        const currentG = gScore.get(current) ?? Infinity;
        
        currentNode.connections.forEach(connection => {
            const neighborId = connection.nodeId;
            if (closedSet.has(neighborId)) return;
            
            const tentativeG = currentG + connection.distance;
            const neighborG = gScore.get(neighborId) ?? Infinity;
            
            if (tentativeG < neighborG) {
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

class MinHeap {
    constructor() {
        this.heap = [];
        this.pos = new Map();
    }

    push(item) {
        const idx = this.pos.get(item.id);
        if (idx !== undefined) {
            if (item.f >= this.heap[idx].f) return;
            this.heap[idx] = item;
            this._bubbleUp(idx);
            return;
        }
        this.pos.set(item.id, this.heap.length);
        this.heap.push(item);
        this._bubbleUp(this.heap.length - 1);
    }

    pop() {
        const top = this.heap[0];
        this.pos.delete(top.id);
        const last = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this.pos.set(last.id, 0);
            this._sinkDown(0);
        }
        return top;
    }

    isEmpty() { return this.heap.length === 0; }

    _swap(i, j) {
        this.pos.set(this.heap[i].id, j);
        this.pos.set(this.heap[j].id, i);
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }

    _bubbleUp(i) {
        while (i > 0) {
            const parent = Math.floor((i - 1) / 2);
            if (this.heap[parent].f <= this.heap[i].f) break;
            this._swap(parent, i);
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
            this._swap(smallest, i);
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
export function getNodeById(id) { return nodeById.get(id);}