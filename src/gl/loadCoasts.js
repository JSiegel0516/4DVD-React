import * as THREE from 'three';
import { geojsonToThreejsCoordinates } from '../geojsonToThreejs';

export async function loadCoasts(isPacificCentered = false, isMercator = false, resolution = 'None', signal) {
  const group = new THREE.Group();
  if (resolution === 'None') {
    return group;
  }

  let filePath;
  switch (resolution) {
    case 'Low':
      filePath = './assets/ne_110m_coastline.json';
      break;
    case 'Medium':
      filePath = './assets/ne_50m_coastline.json';
      break;
    case 'High':
      filePath = './assets/ne_10m_coastline.json';
      break;
    default:
      console.warn(`Invalid resolution: ${resolution}. Returning empty group.`);
      return group;
  }

  try {
    const response = await fetch(filePath, { signal });
    if (!response.ok) {
      throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
    }
    const data = await response.json();

    if (!data.Lon || !data.Lat || !Array.isArray(data.Lon) || !Array.isArray(data.Lat) || data.Lon.length !== data.Lat.length) {
      console.error(`Invalid data format in ${filePath}. Expected { Lon: [], Lat: [] } with equal-length arrays, got:`, data);
      return group;
    }

    const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const radius = 2.01;
    
    // Helper function to detect seam crossing in Pacific-centered mode
    const crossesSeam = (lon1, lon2, isPacific) => {
      if (!isPacific) return false;
      // In Pacific-centered mode (0-360°), detect if line crosses near 0°/360°
      const threshold = 180; // If distance > 180°, it likely crosses the seam
      return Math.abs(lon2 - lon1) > threshold;
    };

    let currentCoords = [];
    for (let i = 0; i < data.Lon.length; i++) {
      if (data.Lon[i] === null || data.Lat[i] === null) {
        if (currentCoords.length > 1) {
          // Process the segment, splitting at seam crossings if necessary
          const normalizedCoords = currentCoords.map(([rawLon, lat]) => {
            let adjustedLon = rawLon;
            if (!isMercator) {
              if (isPacificCentered) {
                adjustedLon = rawLon < 0 ? rawLon + 360 : rawLon;
              } else {
                adjustedLon = rawLon > 180 ? rawLon - 360 : rawLon;
              }
            } else if (isPacificCentered && rawLon < 0) {
              adjustedLon = rawLon + 360;
            }
            return [adjustedLon, lat];
          });
          
          // Split segments that cross the seam
          if (isPacificCentered) {
            const segments = [];
            let currentSegment = [normalizedCoords[0]];
            
            for (let j = 1; j < normalizedCoords.length; j++) {
              const prevLon = normalizedCoords[j - 1][0];
              const currLon = normalizedCoords[j][0];
              
              if (crossesSeam(prevLon, currLon, true)) {
                // Split here - finish current segment
                if (currentSegment.length > 1) {
                  segments.push(currentSegment);
                }
                // Start new segment
                currentSegment = [normalizedCoords[j]];
              } else {
                currentSegment.push(normalizedCoords[j]);
              }
            }
            
            // Add final segment
            if (currentSegment.length > 1) {
              segments.push(currentSegment);
            }
            
            // Render each segment
            segments.forEach(segment => {
              const points = geojsonToThreejsCoordinates(segment, radius, isPacificCentered, isMercator);
              if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, material);
                group.add(line);
              }
            });
          } else {
            // No splitting needed for Atlantic-centered
            const points = geojsonToThreejsCoordinates(normalizedCoords, radius, isPacificCentered, isMercator);
            if (points.length > 1) {
              const geometry = new THREE.BufferGeometry().setFromPoints(points);
              const line = new THREE.Line(geometry, material);
              group.add(line);
            }
          }
        }
        currentCoords = [];
      } else {
        currentCoords.push([data.Lon[i], data.Lat[i]]);
      }
    }
    
    // Handle final segment
    if (currentCoords.length > 1) {
      const normalizedCoords = currentCoords.map(([rawLon, lat]) => {
        let adjustedLon = rawLon;
        if (!isMercator) {
          if (isPacificCentered) {
            adjustedLon = rawLon < 0 ? rawLon + 360 : rawLon;
          } else {
            adjustedLon = rawLon > 180 ? rawLon - 360 : rawLon;
          }
        } else if (isPacificCentered && rawLon < 0) {
          adjustedLon = rawLon + 360;
        }
        return [adjustedLon, lat];
      });
      
      if (isPacificCentered) {
        const segments = [];
        let currentSegment = [normalizedCoords[0]];
        
        for (let j = 1; j < normalizedCoords.length; j++) {
          const prevLon = normalizedCoords[j - 1][0];
          const currLon = normalizedCoords[j][0];
          
          if (crossesSeam(prevLon, currLon, true)) {
            if (currentSegment.length > 1) {
              segments.push(currentSegment);
            }
            currentSegment = [normalizedCoords[j]];
          } else {
            currentSegment.push(normalizedCoords[j]);
          }
        }
        
        if (currentSegment.length > 1) {
          segments.push(currentSegment);
        }
        
        segments.forEach(segment => {
          const points = geojsonToThreejsCoordinates(segment, radius, isPacificCentered, isMercator);
          if (points.length > 1) {
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            group.add(line);
          }
        });
      } else {
        const points = geojsonToThreejsCoordinates(normalizedCoords, radius, isPacificCentered, isMercator);
        if (points.length > 1) {
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geometry, material);
          group.add(line);
        }
      }
    }

    console.log(`Loaded ${group.children.length} coastlines from ${filePath} (Pacific: ${isPacificCentered})`);
    return group;
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error(`Error loading coasts from ${filePath}: ${error.message}`);
    }
    return group;
  }
}