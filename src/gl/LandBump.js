import * as THREE from 'three';

export async function loadBumpMap(bumpMapType = 'None') {
  const bumpMapping = [
    {
      value: 'Land',
      file: './assets/earth_normalmap_flat_8192x4096.jpg'
    },
    {
      value: 'Land & Bathymetry',
      file: './assets/earth_normalmap_8192x4096.jpg'
    },
    {
      value: 'None',
      file: ''
    }
  ];

  const selectedBump = bumpMapping.find(map => map.value === bumpMapType) || bumpMapping.find(map => map.value === 'None');
  let bumpTexture = null;

  if (selectedBump.file) {
    try {
      const textureLoader = new THREE.TextureLoader();
      bumpTexture = await textureLoader.loadAsync(selectedBump.file);
      bumpTexture.wrapS = bumpTexture.wrapT = THREE.RepeatWrapping;
      console.log(`Loaded bump map: ${selectedBump.file}`);
    } catch (error) {
      console.error(`Error loading bump map from ${selectedBump.file}: ${error.message}`);
    }
  } else {
    console.log('No bump map applied (None selected).');
  }

  return bumpTexture;
}