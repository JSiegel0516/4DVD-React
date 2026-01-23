import * as THREE from 'three';

// Returns THREE.Vector3[] for either 3D sphere (isMercator=false) or flat 2D equirectangular (isMercator=true)
// In 2D mode we align with the background data texture, which is equirectangular (linear lon/lat spacing).
export function geojsonToThreejsCoordinates(coordinates, radius, isPacificCentered = false, isMercator = false) {
  const points = [];
  const planeWidth = 10;
  const planeHeight = 5;

  coordinates.forEach(([lon, lat]) => {
    if (isMercator) {
      // Flat 2D equirectangular mapping to align with texture
      let adjustedLon = lon;
      if (isPacificCentered) {
        adjustedLon = lon < 0 ? lon + 360 : lon; // 0..360
        const x = ((adjustedLon - 180) / 180) * (planeWidth / 2);
        const y = (lat / 90) * (planeHeight / 2);
        points.push(new THREE.Vector3(x, y, 0.01));
      } else {
        const x = (lon / 180) * (planeWidth / 2);
        const y = (lat / 90) * (planeHeight / 2);
        points.push(new THREE.Vector3(x, y, 0.01));
      }
    } else {
      // Spherical projection for 3D globe
      const phi = (90 - lat) * (Math.PI / 180);
      let theta = -lon * (Math.PI / 180);
      if (isPacificCentered) {
        theta += Math.PI;
        if (theta > Math.PI) theta -= 2 * Math.PI;
      }
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      points.push(new THREE.Vector3(x, y, z));
    }
  });

  return points;
}