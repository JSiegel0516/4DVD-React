//src/gl/GraticuleLines.js
import * as THREE from 'three';

export function createGraticuleLines(pacificCentered = false, isMercator = false) {
  const group = new THREE.Group();
  const step = 10; // degrees
  const radius = 2.02; // Slightly larger than globe radius (2)

  const lonMin = pacificCentered ? 0 : -180;
  const lonMax = pacificCentered ? 360 : 180;

  if (isMercator) {
    // 2D equirectangular grid to match flat background texture
    const planeWidth = 10;
    const planeHeight = 5;

    // Latitude lines (parallels)
    for (let lat = -90; lat <= 90; lat += step) {
      const points = [];
      const lonStart = pacificCentered ? 0 : -180;
      const lonEnd = pacificCentered ? 360 : 180;
      for (let lon = lonStart; lon <= lonEnd; lon += 1) {
        points.push(equirectangularToVector3(lat, lon, planeWidth, planeHeight, pacificCentered));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 1 })));
    }

    // Longitude lines (meridians)
    for (let lon = lonMin; lon <= lonMax; lon += step) {
      const points = [];
      for (let lat = -90; lat <= 90; lat += 1) {
        points.push(equirectangularToVector3(lat, lon, planeWidth, planeHeight, pacificCentered));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 1 })));
    }
  } else {
    // Longitude lines (meridians) for 3D
    for (let lon = lonMin; lon <= lonMax; lon += step) {
      const points = [];
      for (let lat = -90; lat <= 90; lat++) {
        points.push(latLonToVector3(lat, lon, radius));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x888888 })));
    }
    // Latitude lines (parallels) for 3D
    for (let lat = -80; lat <= 80; lat += step) {
      const points = [];
      for (let lon = lonMin; lon <= lonMax; lon++) {
        points.push(latLonToVector3(lat, lon, radius));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x888888 })));
    }
  }

  return group;
}

function latLonToVector3(lat, lon, radius = 2.02) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = lon * (Math.PI / 180);

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