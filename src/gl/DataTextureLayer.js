import * as THREE from "three";
import { VIRIDIS } from "../utils/colormap";

// Build a texture (equirectangular) from grid payload: { lats[], lons[], grid[][], min, max }
export function makeTextureFromGrid(payload) {
  const { lats, lons, grid, min, max } = payload;
  if (!lats?.length || !lons?.length || !grid?.length) return null;

  const W = lons.length, H = lats.length;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(W, H);

  const vmin = min ?? 0, vmax = max ?? 1e-9;

  for (let y=0; y<H; y++) {
    for (let x=0; x<W; x++) {
      const v = grid[y][x];
      const i = (y*W + x)*4;
      if (v == null || Number.isNaN(v)) {
        // Render N/A values as black
        img.data[i] = 0;     // R
        img.data[i+1] = 0;   // G
        img.data[i+2] = 0;   // B
        img.data[i+3] = 255; // A (opaque)
      } else {
        const t = Math.max(0, Math.min(1, (v - vmin) / (vmax - vmin || 1e-9)));
        const c = VIRIDIS[Math.round(t*255)];
        img.data[i] = c[0]; img.data[i+1] = c[1]; img.data[i+2] = c[2]; img.data[i+3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Builds a slightly larger sphere with the texture mapped (equirectangular)
export function makeDataSphere(texture, radius = 2.01) {
  const geom = new THREE.SphereGeometry(radius, 128, 64);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  return new THREE.Mesh(geom, mat);
}
