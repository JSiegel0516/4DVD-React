import * as THREE from 'three';
import { feature } from 'topojson-client';

// Helper function to detect seam crossing in Pacific-centered mode
const crossesSeam = (lon1, lon2, isPacific) => {
  if (!isPacific) return false;
  const threshold = 180;
  return Math.abs(lon2 - lon1) > threshold;
};

// Helper function to split ring at seam crossings
const splitRingAtSeams = (ring, pacificCentered) => {
  if (!pacificCentered || ring.length < 2) {
    return [ring];
  }
  
  const segments = [];
  let currentSegment = [ring[0]];
  
  for (let j = 1; j < ring.length; j++) {
    const prevLon = ring[j - 1][0];
    const currLon = ring[j][0];
    
    // Adjust longitudes for Pacific-centered mode
    let adjustedPrevLon = prevLon < 0 ? prevLon + 360 : prevLon;
    let adjustedCurrLon = currLon < 0 ? currLon + 360 : currLon;
    
    if (crossesSeam(adjustedPrevLon, adjustedCurrLon, true)) {
      if (currentSegment.length > 1) {
        segments.push(currentSegment);
      }
      currentSegment = [ring[j]];
    } else {
      currentSegment.push(ring[j]);
    }
  }
  
  if (currentSegment.length > 1) {
    segments.push(currentSegment);
  }
  
  return segments.length > 0 ? segments : [ring];
};

export async function loadCountryOutlines(pacificCentered = false, isMercator = false) {
  const res = await fetch('/assets/countries-110m.json');
  const topojsonData = await res.json();

  const countries = feature(topojsonData, topojsonData.objects.countries).features;

  const group = new THREE.Group();

  countries.forEach((country) => {
    country.geometry.coordinates.forEach((polygon) => {
      const rings = country.geometry.type === 'Polygon' ? [polygon] : polygon;

      rings.forEach((ring) => {
        // Split ring at seam crossings if Pacific-centered
        const segments = splitRingAtSeams(ring, pacificCentered);
        
        segments.forEach(segment => {
          const points = segment.map(([lon, lat]) => {
            if (isMercator) {
              return equirectangularToVector3(lat, lon, 10, 5, pacificCentered);
            }
            return latLonToVector3(lat, lon, pacificCentered);
          });
          
          if (points.length > 1) {
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x000000 }));
            group.add(line);
          }
        });
      });
    });
  });

  return group;
}

function latLonToVector3(lat, lon, radius = 2.02, pacificCentered = false) {
  const phi = (90 - lat) * (Math.PI / 180);
  let adjustedLon = lon;
  if (pacificCentered && adjustedLon < 0) adjustedLon += 360;
  const theta = adjustedLon * (Math.PI / 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function equirectangularToVector3(lat, lon, width = 10, height = 5, pacificCentered = false) {
  let adjustedLon = lon;
  if (pacificCentered && adjustedLon < 0) adjustedLon += 360; // 0..360
  const x = pacificCentered
    ? ((adjustedLon - 180) / 180) * (width / 2)
    : (lon / 180) * (width / 2);
  const y = (lat / 90) * (height / 2);
  return new THREE.Vector3(x, y, 0.01);
}