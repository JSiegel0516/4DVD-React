import * as THREE from 'three';

export function geojsonToThreejsCoordinates(coords, radius = 2.01, isPacificCentered = false, isMercator = false) {
  if (isMercator) {
    return coords.map(([lon, lat]) => {
      let adjustedLon = lon;
      if (isPacificCentered && lon < 0) adjustedLon += 360;
      const x = (adjustedLon / 360) * 4;
      const y = (Math.log(Math.tan((Math.PI / 4) + (lat * Math.PI / 360))) / (Math.PI / 2)) * 2;
      return new THREE.Vector3(x - 2, -y + 1, 0.25);
    });
  }

  return coords.map(([lon, lat]) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = lon * (Math.PI / 180);
    return new THREE.Vector3(
      radius * Math.sin(phi) * Math.sin(theta), // x (was z)
      radius * Math.cos(phi), // y
      radius * Math.sin(phi) * Math.cos(theta) // z (was x)
    );
  });
}