import * as THREE from 'three';
import { geojsonToThreejsCoordinates } from '../geojsonToThreejs';

// Helper function to detect seam crossing in Pacific-centered mode
const crossesSeam = (lon1, lon2, isPacific) => {
  if (!isPacific) return false;
  const threshold = 180;
  return Math.abs(lon2 - lon1) > threshold;
};

// Helper function to split segments at seam crossings
const splitSegmentAtSeams = (normalizedCoords, isPacific) => {
  if (!isPacific || normalizedCoords.length < 2) {
    return [normalizedCoords];
  }
  
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
  
  return segments.length > 0 ? segments : [normalizedCoords];
};

export async function loadRiversAndLakes(isPacificCentered = false, isMercator = false, riversResolution = 'None', lakesResolution = 'None') {
  const group = new THREE.Group();
  if (riversResolution === 'None' && lakesResolution === 'None') {
    return group;
  }

  let riversFilePath, lakesFilePath;
  switch (riversResolution) {
    case 'Low':
      riversFilePath = './assets/ne_110m_rivers_lake_centerlines.json';
      break;
    case 'Medium':
      riversFilePath = './assets/ne_50m_rivers_lake_centerlines.json';
      break;
    case 'High':
      riversFilePath = './assets/ne_10m_rivers_lake_centerlines.json';
      break;
    default:
      riversFilePath = null;
  }

  switch (lakesResolution) {
    case 'Low':
      lakesFilePath = './assets/ne_110m_lakes.json';
      break;
    case 'Medium':
      lakesFilePath = './assets/ne_50m_lakes.json';
      break;
    case 'High':
      lakesFilePath = './assets/ne_10m_lakes.json';
      break;
    default:
      lakesFilePath = null;
  }

  const materialRiver = new THREE.LineBasicMaterial({ color: 0x0000ff });
  const materialLake = new THREE.MeshBasicMaterial({ color: 0x00aaff, side: THREE.DoubleSide });
  const radius = 2.01;

  if (riversFilePath) {
    try {
      const response = await fetch(riversFilePath);
      if (!response.ok) {
        throw new Error(`Failed to load ${riversFilePath}: ${response.statusText}`);
      }
      const data = await response.json();

      if (!data.Lon || !data.Lat || !Array.isArray(data.Lon) || !Array.isArray(data.Lat) || data.Lon.length !== data.Lat.length) {
        console.error(`Invalid data format in ${riversFilePath}. Expected { Lon: [], Lat: [] } with equal-length arrays, got:`, data);
      } else {
        let currentCoords = [];
        let riverSegmentCount = 0;
        for (let i = 0; i < data.Lon.length; i++) {
          if (data.Lon[i] === null || data.Lat[i] === null) {
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
              
              // Split at seam crossings
              const segments = splitSegmentAtSeams(normalizedCoords, isPacificCentered);
              segments.forEach(segment => {
                const points = geojsonToThreejsCoordinates(segment, radius, isPacificCentered, isMercator);
                if (points.length > 1) {
                  const geometry = new THREE.BufferGeometry().setFromPoints(points);
                  const line = new THREE.Line(geometry, materialRiver);
                  group.add(line);
                  riverSegmentCount++;
                }
              });
            }
            currentCoords = [];
          } else {
            currentCoords.push([data.Lon[i], data.Lat[i]]);
          }
        }
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
          
          const segments = splitSegmentAtSeams(normalizedCoords, isPacificCentered);
          segments.forEach(segment => {
            const points = geojsonToThreejsCoordinates(segment, radius, isPacificCentered, isMercator);
            if (points.length > 1) {
              const geometry = new THREE.BufferGeometry().setFromPoints(points);
              const line = new THREE.Line(geometry, materialRiver);
              group.add(line);
              riverSegmentCount++;
            }
          });
        }
      }
    } catch (error) {
      console.error(`Error loading rivers from ${riversFilePath}: ${error.message}`);
    }
  }

  if (lakesFilePath) {
    try {
      const response = await fetch(lakesFilePath);
      if (!response.ok) {
        throw new Error(`Failed to load ${lakesFilePath}: ${response.statusText}`);
      }
      const data = await response.json();

      if (!data.Lon || !data.Lat || !Array.isArray(data.Lon) || !Array.isArray(data.Lat) || data.Lon.length !== data.Lat.length) {
        console.error(`Invalid data format in ${lakesFilePath}. Expected { Lon: [], Lat: [] } with equal-length arrays, got:`, data);
      } else {
        let currentCoords = [];
        let lakeSegmentCount = 0;
        for (let i = 0; i < data.Lon.length; i++) {
          if (data.Lon[i] === null || data.Lat[i] === null) {
            if (currentCoords.length > 2) {
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
              
              // Split at seam crossings
              const segments = splitSegmentAtSeams(normalizedCoords, isPacificCentered);
              segments.forEach(segment => {
                const points = geojsonToThreejsCoordinates(segment, radius, isPacificCentered, isMercator);
                if (points.length > 2) {
                  const shape = new THREE.Shape(points);
                  const geometry = new THREE.ShapeGeometry(shape);
                  const mesh = new THREE.Mesh(geometry, materialLake);
                  group.add(mesh);
                  lakeSegmentCount++;
                }
              });
            }
            currentCoords = [];
          } else {
            currentCoords.push([data.Lon[i], data.Lat[i]]);
          }
        }
        if (currentCoords.length > 2) {
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
          
          const segments = splitSegmentAtSeams(normalizedCoords, isPacificCentered);
          segments.forEach(segment => {
            const points = geojsonToThreejsCoordinates(segment, radius, isPacificCentered, isMercator);
            if (points.length > 2) {
              const shape = new THREE.Shape(points);
              const geometry = new THREE.ShapeGeometry(shape);
              const mesh = new THREE.Mesh(geometry, materialLake);
              group.add(mesh);
              lakeSegmentCount++;
            }
          });
        }
      }
    } catch (error) {
      console.error(`Error loading lakes from ${lakesFilePath}: ${error.message}`);
    }
  }

  console.log(`Loaded ${group.children.length} rivers and lakes from ${riversFilePath || lakesFilePath} (Pacific: ${isPacificCentered})`);
  return group;
}