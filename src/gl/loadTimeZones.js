import * as THREE from 'three';
import { geojsonToThreejsCoordinates } from '../geojsonToThreejs';

export async function loadTimeZones(isPacificCentered = false, isMercator = false, signal) {
  const group = new THREE.Group();
  const filePath = './assets/ne_10m_time_zones.json';

  try {
    const response = await fetch(filePath, { signal });
    if (!response.ok) {
      throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data?.Lon) || !Array.isArray(data?.Lat) || data.Lon.length !== data.Lat.length) {
      console.error(`Invalid timezone data format in ${filePath}. Expected { Lon: [], Lat: [] }.`);
      return group;
    }

    const material = new THREE.LineBasicMaterial({
      color: 0x4f6d7a,
      transparent: true,
      opacity: 0.7,
    });
    const radius = 2.015;

    const normalizeLon = (rawLon) => {
      if (isMercator) {
        if (isPacificCentered && rawLon < 0) return rawLon + 360;
        return rawLon;
      }
      if (isPacificCentered) return rawLon < 0 ? rawLon + 360 : rawLon;
      return rawLon > 180 ? rawLon - 360 : rawLon;
    };

    const crossesSeam = (lon1, lon2) => isPacificCentered && Math.abs(lon2 - lon1) > 180;

    const addLineSegment = (coords) => {
      if (coords.length < 2) return;
      const points = geojsonToThreejsCoordinates(coords, radius, isPacificCentered, isMercator);
      if (points.length < 2) return;
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      group.add(new THREE.Line(geometry, material));
    };

    const flushSegment = (rawCoords) => {
      if (rawCoords.length < 2) return;
      const normalized = rawCoords.map(([lon, lat]) => [normalizeLon(lon), lat]);

      if (!isPacificCentered) {
        addLineSegment(normalized);
        return;
      }

      let current = [normalized[0]];
      for (let i = 1; i < normalized.length; i++) {
        const prev = normalized[i - 1][0];
        const curr = normalized[i][0];
        if (crossesSeam(prev, curr)) {
          addLineSegment(current);
          current = [normalized[i]];
        } else {
          current.push(normalized[i]);
        }
      }
      addLineSegment(current);
    };

    let currentCoords = [];
    for (let i = 0; i < data.Lon.length; i++) {
      const lon = data.Lon[i];
      const lat = data.Lat[i];
      if (lon === null || lat === null) {
        flushSegment(currentCoords);
        currentCoords = [];
      } else {
        currentCoords.push([lon, lat]);
      }
    }
    flushSegment(currentCoords);

    console.log(`Loaded ${group.children.length} timezone line segments (Pacific: ${isPacificCentered}, Mercator: ${isMercator})`);
    return group;
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error(`Error loading timezones from ${filePath}: ${error.message}`);
    }
    return group;
  }
}
