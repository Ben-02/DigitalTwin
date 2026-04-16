# Curtin University 3D Campus Navigation System (Status: In development)

A web-based digital twin navigation application for Curtin University Bentley Campus. This system enables students, staff, and visitors to explore the campus in 3D and navigate between buildings using optimized pathways.

---

## Overview

This application was developed as part of the ENGR6009/6010 Professional Engineering Research Design Project at Curtin University. The system provides an interactive 3D campus navigation tool with the following capabilities:

- 3D visualization of the Curtin Bentley campus
- Building search by number or name
- Pathfinding between campus locations
- GPS and manual location positioning
- Building information and metadata display

---

## Features

**3D Visualization**
- Real-time 3D building models using Cesium OSM Buildings
- Interactive camera controls
- Campus boundary overlay

**Navigation System**
- A* pathfinding algorithm with 1,916 pathway segments and 3,000+ navigation nodes
- Real-time route calculation and visualization
- Distance and walking time estimation
- Automatic camera framing to display complete routes

**Location Services**
- GPS-based positioning with accuracy indication
- Manual location correction capability
- Visual feedback through color-coded markers
- Revert to GPS functionality

**Building Information**
- Search by building number or name
- Click interaction for building details
- Metadata integration from OpenStreetMap
- Display of building names, departments, and facilities

---

## Technical Implementation

**Frontend Technologies**
- Vanilla JavaScript with ES6 module architecture
- HTML5 and CSS3
- CesiumJS for 3D geospatial visualization

**Data Sources**
- OpenStreetMap for campus building and pathway data
- Cesium ion for 3D Tiles and GeoJSON hosting
- Cesium OSM Buildings for global 3D building dataset

**Algorithms**
- A* pathfinding for optimal route calculation
- Haversine formula for coordinate distance calculation
- Graph-based navigation system

---

## Acknowledgments

This project was developed with supervision and guidance from supervisor at Curtin University. The application utilizes CesiumJS for 3D visualization and OpenStreetMap data for campus mapping information.

---

## License

This project is developed for academic purposes as part of a final year engineering research project at Curtin University.

---
