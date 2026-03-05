import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { createGraticuleLines } from '../gl/GraticuleLines';
import { loadCoasts } from '../gl/loadCoasts';
import { loadRiversAndLakes } from '../gl/loadRiversAndLakes';
import { loadCountryOutlines } from '../gl/loadCountryOutlines';
import { loadBumpMap } from '../gl/LandBump';
import { useGlobeSettings } from './GlobeSettingsContext';
import { Box, Typography, Button, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import ColorMapMenu from './ColorMapMenu';
import { initializeColorMapManager, getColorMapManager } from '../utils/ColorMapManager';
import TimeSeries from './TimeSeries';

// Memoize to prevent rerenders unless props change
const GlobeWireframe = () => {
  const mountRef = useRef();
  const canvasRef = useRef(); // New ref for Three.js canvas
  const graticuleRef = useRef();
  const coastsRef = useRef();
  const riversLakesRef = useRef();
  const countriesRef = useRef(new THREE.Group());
  const controlsRef = useRef();
  const cameraRef = useRef();
  const camera3DRef = useRef(); // Separate ref for 3D camera
  const camera2DRef = useRef(); // Separate ref for 2D camera
  const sphereRef = useRef();
  const planeRef = useRef(); // 2D Mercator plane
  const sceneRef = useRef();
  const rendererRef = useRef();
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const [clickInfo, setClickInfo] = useState(null);
  const [is2DMode, setIs2DMode] = useState(false);
  const [texture, setTexture] = useState(null);
  const [textureOffsetX, setTextureOffsetX] = useState(0.5);
  const [bumpTexture, setBumpTexture] = useState(null);
  const [gridData, setGridData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [openTimeSeries, setOpenTimeSeries] = useState(false);
  const [colorMapManager, setColorMapManager] = useState(null);
  const [colorbar, setColorbar] = useState({ gradient: '', min: 0, max: 1 });
  const fetchIdRef = useRef(0);
  const fetchAbortRef = useRef(null);
  const bumpFetchIdRef = useRef(0);
  const { graphicalSettings, selectedDataset, selectedDate, selectedLevel, metadata, setSelectedLevel, setColormap, colorMapOpen, setColorMapOpen } = useGlobeSettings();

  const getFallbackUnits = (varName) => {
    if (!varName) return 'unknown';
    const unitMap = {
      precip: 'mm/day',
      temp: '°C',
      temperature: '°C',
      air: 'K',
      wind: 'm/s',
    };
    return unitMap[varName.toLowerCase()] || 'unknown';
  };

  const computeTextureOffsetX = useCallback((lons, isPacificCentered) => {
    if (!lons || lons.length === 0) return 0.5;
    
    const lonMin = Math.min(...lons);
    const lonMax = Math.max(...lons);
    const span = lonMax - lonMin || 1;
    
    console.log('Computing texture offset:', {
      isPacificCentered,
      lonMin,
      lonMax,
      span,
      lonRange: [lons[0], lons[lons.length - 1]]
    });
    
    if (isPacificCentered) {
      // Data is in 0-360 range (from backend Pacific centering)
      // Frontend coastlines are already Pacific-centered, no offset needed
      console.log('Pacific centering: no offset');
      return 0.0;
    } else {
      // For Atlantic-centered, apply offset to shift data to match Atlantic coastlines
      console.log('Atlantic centering: applying 0.5 offset');
      return 0.5;
    }
  }, []);

  // Initialize ColorMapManager
  useEffect(() => {
    initializeColorMapManager().then((manager) => {
      setColorMapManager(manager);
      console.log('ColorMapManager initialized with', manager.ColorMaps.length, 'colormaps');
    });
  }, []);

  // Load bump map texture
  useEffect(() => {
    let isMounted = true;

    async function fetchBumpMap() {
      const bumpFetchId = ++bumpFetchIdRef.current;
      if (!graphicalSettings.bumpMapping || graphicalSettings.bumpMapping === 'None') {
        if (bumpTexture) {
          bumpTexture.dispose();
          setBumpTexture(null);
          console.log('Cleared bump texture (None selected)');
        }
        if (sphereRef.current) {
          sphereRef.current.material.normalMap = null;
          sphereRef.current.material.normalScale = new THREE.Vector2(0, 0);
          sphereRef.current.material.needsUpdate = true;
        }
        return;
      }

      if (sphereRef.current) {
        sphereRef.current.material.normalMap = null;
        sphereRef.current.material.normalScale = new THREE.Vector2(0, 0);
        sphereRef.current.material.needsUpdate = true;
      }

      console.log('Loading bump map:', graphicalSettings.bumpMapping);
      const newBumpTexture = await loadBumpMap(graphicalSettings.bumpMapping);
      if (!isMounted || bumpFetchId !== bumpFetchIdRef.current) {
        if (newBumpTexture) {
          newBumpTexture.dispose();
        }
        return;
      }
      if (isMounted) {
        if (bumpTexture) {
          bumpTexture.dispose();
          console.log('Disposed previous bump texture');
        }
        setBumpTexture(newBumpTexture);
        console.log('Bump texture set:', newBumpTexture ? graphicalSettings.bumpMapping : 'None');
      }
    }

    fetchBumpMap();

    return () => {
      isMounted = false;
    };
  }, [graphicalSettings.bumpMapping]);

  useEffect(() => {
    if (!bumpTexture) return;
    // Bump map assets are atlantic-centered by default. Shift when pacific is enabled.
    bumpTexture.offset.x = graphicalSettings.pacificCentered ? 0.5 : 0.0;
    bumpTexture.offset.y = 0.0;
    bumpTexture.needsUpdate = true;
    if (sphereRef.current) {
      sphereRef.current.material.normalMap = bumpTexture;
      sphereRef.current.material.needsUpdate = true;
    }
  }, [graphicalSettings.pacificCentered, bumpTexture]);

  // Fetch grid data
  useEffect(() => {
    if (!selectedDataset || !selectedDate) {
      console.log('Skipping grid fetch: missing dataset/date', {
        selectedDataset: !!selectedDataset,
        selectedDate: !!selectedDate,
      });
      return;
    }

    const metadataReadyForDataset = !metadata.metadata_loading && metadata.dataset_path === selectedDataset.relative_path;
    if (!metadataReadyForDataset) {
      console.log('Skipping grid fetch: metadata not ready for selected dataset', {
        selectedPath: selectedDataset.relative_path,
        metadataPath: metadata.dataset_path,
        metadataLoading: metadata.metadata_loading,
      });
      return;
    }

    if (metadata.multilevel && !selectedLevel) {
      console.log('Skipping grid fetch: multilevel dataset without selected level');
      return;
    }

    const currentFetchId = ++fetchIdRef.current;
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    console.log('Fetching grid for', selectedDataset.name, 'on', selectedDate, 'level', selectedLevel);
    setIsLoading(true);
    const levelParam = metadata.multilevel && selectedLevel ? `&level=${selectedLevel}` : '';
    fetch(`/api/slice?path=${encodeURIComponent(selectedDataset.relative_path)}&variable=${selectedDataset.name}&date=${selectedDate}&center=${graphicalSettings.pacificCentered ? 'pacific' : 'atlantic'}${levelParam}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        if (currentFetchId !== fetchIdRef.current) {
          console.log('Ignoring stale grid response');
          return;
        }
        console.log('Fetched grid data:', {
          var: data.var,
          date: data.date_selected,
          min: data.min,
          max: data.max,
          lats: data.lats?.length,
          lons: data.lons?.length,
          lonRange: data.lons ? [data.lons[0], data.lons[data.lons.length - 1]] : null,
        });
        if (data && data.values && Array.isArray(data.values) && data.lats && data.lons && data.values.length > 0 && data.lats.length > 0 && data.lons.length > 0) {
          setGridData(data);
        } else {
          console.error('Invalid grid data received:', data);
          setGridData(null);
          setTexture(null);
          setClickInfo(null);
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('Error fetching grid data:', err);
        setGridData(null);
        setTexture(null);
        setClickInfo(null);
      })
      .finally(() => {
        if (currentFetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      });
    return () => {
      controller.abort();
    };
  }, [selectedDataset, selectedDate, selectedLevel, graphicalSettings.pacificCentered, metadata.multilevel, metadata.metadata_loading, metadata.dataset_path]);

  // Generate texture
  useEffect(() => {
    if (!gridData || !gridData.values || !Array.isArray(gridData.values) || gridData.values.length === 0 || !gridData.lats || !gridData.lons || gridData.lats.length === 0 || gridData.lons.length === 0) {
      console.log('Skipping texture generation due to invalid grid data:', { gridData });
      if (texture) {
        texture.dispose();
        setTexture(null);
        console.log('Cleared previous texture due to invalid grid data');
      }
      return;
    }

    const { lats, lons, values, min: apiMin, max: apiMax } = gridData;
    const colormap = metadata.colormap || 'viridis';
    console.log('Generating texture:', {
      colormap,
      apiMin,
      apiMax,
      gridSize: `${lats.length}x${lons.length}`,
      pacific: graphicalSettings.pacificCentered,
    });

    let computedMin = apiMin;
    let computedMax = apiMax;
    if (!isFinite(apiMin) || !isFinite(apiMax) || apiMax === 0 || apiMax <= apiMin) {
      const validValues = values.flat().filter((v) => v !== null && isFinite(v));
      computedMin = validValues.length > 0 ? Math.min(...validValues) : 0;
      computedMax = validValues.length > 0 ? Math.max(...validValues) : 50;
      console.log('Computed min/max from values:', { computedMin, computedMax, validCount: validValues.length });
    }

    const canvas = document.createElement('canvas');
    canvas.width = lons.length;
    canvas.height = lats.length;
    const ctx = canvas.getContext('2d');

    try {
      if (!colorMapManager) {
        console.warn('ColorMapManager not ready yet');
        return;
      }
      const colors = colorMapManager.generateRGBAStrings(colormap, 256);
      console.log('Colormap colors generated:', { colormap, colorCount: colors.length, firstColor: colors[0], lastColor: colors[255] });
      // Build a CSS gradient string for the colorbar (top -> bottom)
      const stops = colors.filter((_, idx) => idx % 8 === 0 || idx === colors.length - 1)
        .map((c, idx, arr) => {
          const pct = (idx / (arr.length - 1)) * 100;
          return `${c} ${pct}%`;
        });
      const gradientCss = `linear-gradient(180deg, ${stops.join(', ')})`;
      setColorbar({ gradient: gradientCss, min: computedMin, max: computedMax });
      let invalidCount = 0;

      for (let i = 0; i < lats.length; i++) {
        if (!Array.isArray(values[i])) {
          console.warn(`Row ${i} is not an array. Type: ${typeof values[i]}, Value:`, values[i]);
          invalidCount += lons.length;
          continue;
        }
        if (values[i].length !== lons.length) {
          console.warn(`Row ${i} has length mismatch: expected ${lons.length}, got ${values[i].length}`);
          invalidCount += Math.max(0, lons.length - values[i].length);
        }
        for (let j = 0; j < lons.length; j++) {
          const value = values[i][j];
          if (value === null || value === undefined || !isFinite(value)) {
            ctx.fillStyle = 'rgba(0,0,0,1)';  // Black for N/A values
            invalidCount++;
          } else {
            const normalized = Math.max(0, Math.min(1, (value - computedMin) / (computedMax - computedMin)));
            if (!isFinite(normalized)) {
              console.warn('Invalid normalized value:', { value, computedMin, computedMax, i, j });
              ctx.fillStyle = 'rgba(0,0,0,1)';  // Black for invalid values
              invalidCount++;
            } else {
              const colorIdx = Math.floor(normalized * 255);
              ctx.fillStyle = colors[colorIdx];
            }
          }
          ctx.fillRect(j, lats.length - 1 - i, 1, 1);
        }
      }
      const totalPixels = lats.length * lons.length;
      const validPixels = totalPixels - invalidCount;
      const validPercentage = ((validPixels / totalPixels) * 100).toFixed(1);
      console.log('Texture generated:', { 
        invalidPixels: invalidCount, 
        validPixels,
        total: totalPixels,
        validPercentage: `${validPercentage}%`
      });
      if (validPercentage < 50) {
        console.warn(`⚠️ WARNING: Only ${validPercentage}% of pixels contain valid data. This dataset may have extensive missing values.`);
      }

      if (texture) {
        texture.dispose();
        console.log('Disposed previous texture before creating new one');
      }

      const newTexture = new THREE.CanvasTexture(canvas);
      newTexture.minFilter = THREE.LinearFilter;
      newTexture.magFilter = THREE.LinearFilter;
      newTexture.wrapS = THREE.RepeatWrapping;
      newTexture.wrapT = THREE.ClampToEdgeWrapping;
      newTexture.flipY = false;
      const offsetX = computeTextureOffsetX(lons, graphicalSettings.pacificCentered);
      setTextureOffsetX(offsetX);
      newTexture.offset = new THREE.Vector2(offsetX, 0);
      setTexture(newTexture);
    } catch (err) {
      console.error('Error generating texture:', err);
      setTexture(null);
    }
  }, [gridData, graphicalSettings.pacificCentered, metadata.colormap, colorMapManager, computeTextureOffsetX]);

  // Ensure material updates when textures change
  useEffect(() => {
    if (is2DMode && planeRef.current && texture) {
      console.log('Updating plane material with texture');
      // 2D plane needs the computed offset because its geometry is set up for different centering
      const flatTexture = texture.clone();
      flatTexture.offset.set(textureOffsetX, 0);
      flatTexture.repeat.set(1, 1);
      flatTexture.wrapS = THREE.RepeatWrapping;
      flatTexture.wrapT = THREE.ClampToEdgeWrapping;
      flatTexture.needsUpdate = true;
      
      planeRef.current.material.map = flatTexture;
      planeRef.current.material.needsUpdate = true;
      
      // Ensure sphere is hidden and cleared in 2D mode
      if (sphereRef.current) {
        sphereRef.current.visible = false;
        sphereRef.current.material.map = null;
        sphereRef.current.material.normalMap = null;
        sphereRef.current.material.needsUpdate = true;
      }
    } else if (!is2DMode && sphereRef.current) {
      console.log('Updating sphere material with textures', { hasTexture: !!texture, hasBumpTexture: !!bumpTexture });
      sphereRef.current.material.map = texture;
      sphereRef.current.material.normalMap = bumpTexture;
      sphereRef.current.material.normalScale = bumpTexture ? new THREE.Vector2(500.0, 500.0) : new THREE.Vector2(0, 0);
      sphereRef.current.material.needsUpdate = true;
      
      // Ensure plane is hidden in 3D mode
      if (planeRef.current) {
        planeRef.current.visible = false;
        planeRef.current.material.map = null;
        planeRef.current.material.needsUpdate = true;
      }
    }
  }, [texture, bumpTexture, is2DMode, textureOffsetX]);

  // Handle globe click with rotation correction
  const handleClick = useCallback((event) => {
    // Prevent clicks on UI elements from triggering raycast
    if (event.target.closest('#ui-panel') || event.target.tagName === 'BUTTON' || event.target.closest('.MuiSelect-root')) {
      console.log('Click on UI element, skipping raycast', { target: event.target });
      return;
    }

    const targetMesh = is2DMode ? planeRef.current : sphereRef.current;
    if (!mountRef.current || !cameraRef.current || !targetMesh || !gridData) {
      console.log('Cannot process click, missing refs or gridData:', {
        mount: !!mountRef.current,
        camera: !!cameraRef.current,
        mesh: !!targetMesh,
        gridData: !!gridData,
      });
      setClickInfo(null);
      return;
    }

    console.log('Globe/Map clicked, processing raycast, mode:', is2DMode ? '2D' : '3D');
    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    raycasterRef.current.near = 0.1;
    raycasterRef.current.far = 1000;
    const intersects = raycasterRef.current.intersectObject(targetMesh, false);

    console.log('Intersects:', intersects.length, intersects);
    console.log('Raycaster debug:', {
      cameraPosition: cameraRef.current.position,
      mouse: mouseRef.current,
    });

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const { uv } = intersect;

      if (!uv) {
        console.log('No UV data in intersection');
        setClickInfo(null);
        return;
      }

      // Convert UV to lat/lon
      let lon = uv.x * 360 - 180;
      let lat = uv.y * 180 - 90;

      // Adjust for Pacific-centered view
      if (graphicalSettings.pacificCentered) {
        lon = ((lon + 180) % 360) - 180; // Normalize to [-180, 180]
      }

      // Debug coordinate calculation
      console.log('Coordinate calculation:', {
        uvX: uv.x,
        uvY: uv.y,
        rawLat: lat,
        rawLon: lon,
        pacificCentered: graphicalSettings.pacificCentered,
      });

      // Get value from gridData
      const { lats, lons, values } = gridData;
      const latIdx = Math.floor((1 - uv.y) * lats.length);
      const lonIdx = Math.floor(uv.x * lons.length);
      const value = values && Array.isArray(values[latIdx]) ? values[latIdx][lonIdx] : null;

      // Validate indices
      console.log('Grid indices:', {
        latIdx,
        lonIdx,
        gridLat: lats[latIdx],
        gridLon: lons[lonIdx],
        latsRange: [lats[0], lats[lats.length - 1]],
        lonsRange: [lons[0], lons[lons.length - 1]],
      });

      const datasetName = metadata.title.includes('GPCP') ? 'GPCP V2.3' : metadata.title.split(' ').slice(0, 3).join(' ');

      const newClickInfo = {
        dataset: datasetName,
        units: metadata.units || getFallbackUnits(selectedDataset?.name),
        lat: `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`,
        lon: `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`,
        value: value !== null && isFinite(value) ? value.toFixed(2) : 'N/A',
        rawLat: lat,
        rawLon: lon,
        varName: selectedDataset?.name || 'precip',
      };

      console.log('Setting clickInfo:', newClickInfo);
      setClickInfo(newClickInfo);
    } else {
      console.log('No intersections with globe/map');
      setClickInfo(null);
    }
  }, [metadata.title, metadata.units, gridData, selectedDataset, graphicalSettings.pacificCentered, is2DMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      console.log('Attaching click listener to canvas:', canvas);
      canvas.addEventListener('click', handleClick);
    }
    return () => {
      if (canvas) canvas.removeEventListener('click', handleClick);
    };
  }, [handleClick]);

  // Initialize Three.js scene
  useEffect(() => {
    const width = mountRef.current?.clientWidth;
    const height = mountRef.current?.clientHeight;

    if (!width || !height) {
      console.log('Cannot initialize scene: invalid mount dimensions', { width, height });
      return;
    }

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 3D Perspective Camera
    const camera3D = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera3D.position.set(4, 1, 4);
    camera3D.lookAt(0, 0, 0);
    scene.add(camera3D);
    camera3DRef.current = camera3D;

    // 2D Orthographic Camera - set up to show full Mercator map
    const aspect = width / height;
    const frustumHeight = 6; // Vertical view size to fit map with margins
    const frustumWidth = frustumHeight * aspect;
    const camera2D = new THREE.OrthographicCamera(
      -frustumWidth / 2,
      frustumWidth / 2,
      frustumHeight / 2,
      -frustumHeight / 2,
      0.1,
      1000
    );
    camera2D.position.set(0, 0, 10);
    camera2D.lookAt(0, 0, 0);
    camera2D.zoom = 1.0; // Start at 1x zoom to show full map
    camera2D.updateProjectionMatrix();
    scene.add(camera2D);
    camera2DRef.current = camera2D;

    // Start with 3D camera
    cameraRef.current = camera3D;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0xffffff, 1);
    rendererRef.current = renderer;
    mountRef.current.innerHTML = '';
    const canvas = renderer.domElement;
    canvasRef.current = canvas;
    mountRef.current.appendChild(canvas);

    const controls = new OrbitControls(camera3D, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.5;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 20;
    controlsRef.current = controls;

    // 3D sphere
    const material3D = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      wireframe: false,
      map: null,
      normalMap: null,
      normalScale: new THREE.Vector2(0, 0),
      transparent: true,
      roughness: 1.0,
      metalness: 0.1,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(2, 64, 64), material3D);
    sphere.geometry.computeBoundingSphere();
    scene.add(sphere);
    sphereRef.current = sphere;

    // 2D Mercator plane - true flat rectangular map
    // Mercator covers -180° to +180° lon and approximately -85° to +85° lat
    // Using 2:1 aspect ratio for proper world map display
    const planeWidth = 10; // Width for longitude range
    const planeHeight = 5; // Height for latitude range (2:1 ratio)
    const material2D = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: null,
      transparent: false,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight, 1, 1), material2D);
    plane.visible = false;
    plane.position.set(0, 0, 0); // Centered at origin
    plane.renderOrder = 10; // Render after sphere to ensure it's on top
    scene.add(plane);
    planeRef.current = plane;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    // Initial graticule
    graticuleRef.current = createGraticuleLines(graphicalSettings.pacificCentered, false);
    graticuleRef.current.visible = graphicalSettings.latLonLines;
    scene.add(graticuleRef.current);

    // Initial coasts load
    console.log(`Initial load: coasts=${graphicalSettings.coasts}, pacificCentered=${graphicalSettings.pacificCentered}`);
    const coastsPromise = graphicalSettings.coasts !== 'None'
      ? loadCoasts(graphicalSettings.pacificCentered, false, graphicalSettings.coasts)
      : Promise.resolve(new THREE.Group());
    coastsPromise.then((coasts) => {
      console.log(`Coasts loaded: ${coasts.children.length} lines`);
      coastsRef.current = coasts;
      scene.add(coasts);
    });

    // Initial rivers and lakes load
    console.log(`Initial load: rivers=${graphicalSettings.rivers}, lakes=${graphicalSettings.lakes}, pacificCentered=${graphicalSettings.pacificCentered}`);
    loadRiversAndLakes(graphicalSettings.pacificCentered, false, graphicalSettings.rivers, graphicalSettings.lakes).then((riversLakes) => {
      console.log(`Rivers and Lakes loaded: ${riversLakes.children.length} objects`);
      riversLakesRef.current = riversLakes;
      scene.add(riversLakes);
    });

    // Initial country outlines load
    console.log(`Initial load: countries=${graphicalSettings.countries || 'Off'}, pacificCentered=${graphicalSettings.pacificCentered}`);
    const countriesPromise = (graphicalSettings.countries === 'On')
      ? loadCountryOutlines(graphicalSettings.pacificCentered, false)
      : Promise.resolve(new THREE.Group());
    countriesPromise.then((countries) => {
      console.log(`Countries loaded: ${countries.children.length} lines`);
      countriesRef.current = countries;
      scene.add(countries);
    });

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, cameraRef.current);
    };
    animate();

    const handleResize = () => {
      const newWidth = mountRef.current.clientWidth;
      const newHeight = mountRef.current.clientHeight;
      renderer.setSize(newWidth, newHeight);
      
      const newAspect = newWidth / newHeight;
      
      // Update 3D camera
      if (camera3DRef.current) {
        camera3DRef.current.aspect = newAspect;
        camera3DRef.current.updateProjectionMatrix();
      }
      
      // Update 2D camera
      if (camera2DRef.current) {
        const frustumHeight = 6;
        const frustumWidth = frustumHeight * newAspect;
        camera2DRef.current.left = -frustumWidth / 2;
        camera2DRef.current.right = frustumWidth / 2;
        camera2DRef.current.top = frustumHeight / 2;
        camera2DRef.current.bottom = -frustumHeight / 2;
        camera2DRef.current.updateProjectionMatrix();
      }
      
      if (texture) texture.needsUpdate = true;
      if (bumpTexture) bumpTexture.needsUpdate = true;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      if (texture) texture.dispose();
      if (bumpTexture) bumpTexture.dispose();

      if (graticuleRef.current) {
        scene.remove(graticuleRef.current);
        graticuleRef.current.children.forEach((child) => {
          child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
      if (coastsRef.current) {
        scene.remove(coastsRef.current);
        coastsRef.current.children.forEach((child) => {
          child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
      if (riversLakesRef.current) {
        scene.remove(riversLakesRef.current);
        riversLakesRef.current.children.forEach((child) => {
          child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
      if (countriesRef.current) {
        scene.remove(countriesRef.current);
        countriesRef.current.children.forEach((child) => {
          child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
    };
  }, []);

  // Update graphical settings
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current || !sphereRef.current || !sceneRef.current || !graticuleRef.current || !rendererRef.current) return;

    const validResolutions = ['Low', 'Medium', 'High', 'None'];
    const { globeView, pacificCentered, rivers, lakes, coasts, latLonLines, countries } = graphicalSettings;
    const aspect = mountRef.current?.clientWidth / mountRef.current?.clientHeight;

    if (!aspect) return;

    if (!validResolutions.includes(rivers)) {
      console.warn(`Invalid rivers resolution: ${rivers}. Valid options: ${validResolutions.join(', ')}`);
    }
    if (!validResolutions.includes(lakes)) {
      console.warn(`Invalid lakes resolution: ${lakes}. Valid options: ${validResolutions.join(', ')}`);
    }
    if (!validResolutions.includes(coasts)) {
      console.warn(`Invalid coasts resolution: ${coasts}. Valid options: ${validResolutions.join(', ')}`);
    }

    const currentPosition = cameraRef.current.position.clone();
    const currentTarget = controlsRef.current.target.clone();
    const distance = currentPosition.distanceTo(currentTarget);

    // Handle 2D Mercator mode switch
    if (globeView === '2D Mercator') {
      console.log('Switching to 2D Mercator mode');
      setIs2DMode(true);
      
      // Switch to orthographic camera
      cameraRef.current = camera2DRef.current;
      controlsRef.current.object = camera2DRef.current;
      
      // Position camera for top-down view
      camera2DRef.current.position.set(0, 0, 10);
      camera2DRef.current.lookAt(0, 0, 0);
      camera2DRef.current.updateProjectionMatrix();
      
      // Update controls for 2D pan/zoom
      controlsRef.current.enableRotate = false;
      controlsRef.current.enablePan = true;
      controlsRef.current.enableZoom = true;
      controlsRef.current.zoomSpeed = 1.0;
      controlsRef.current.screenSpacePanning = true;
      controlsRef.current.minZoom = 0.5;
      controlsRef.current.maxZoom = 10;
      controlsRef.current.target.set(0, 0, 0);
      
      // Hide and clear sphere completely
      if (sphereRef.current) {
        sphereRef.current.visible = false;
        sphereRef.current.material.map = null;
        sphereRef.current.material.normalMap = null;
        sphereRef.current.material.needsUpdate = true;
      }
      
      // Show plane with texture (clone and keep offset for alignment)
      if (planeRef.current && texture) {
        const flatTexture = texture.clone();
        flatTexture.offset.set(textureOffsetX, 0);
        flatTexture.repeat.set(1, 1);
        flatTexture.wrapS = THREE.RepeatWrapping;
        flatTexture.wrapT = THREE.ClampToEdgeWrapping;
        flatTexture.needsUpdate = true;
        
        planeRef.current.visible = true;
        planeRef.current.material.map = flatTexture;
        planeRef.current.material.needsUpdate = true;
      }
      
      // Remove 3D overlays and load 2D flat versions
      if (graticuleRef.current) {
        sceneRef.current.remove(graticuleRef.current);
        graticuleRef.current.children.forEach((child) => {
          child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
      if (coastsRef.current) {
        sceneRef.current.remove(coastsRef.current);
        coastsRef.current.children.forEach((child) => {
          child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
      if (riversLakesRef.current) {
        sceneRef.current.remove(riversLakesRef.current);
        riversLakesRef.current.children.forEach((child) => {
          child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
      if (countriesRef.current) {
        sceneRef.current.remove(countriesRef.current);
        countriesRef.current.children.forEach((child) => {
          child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
      
      // Load 2D flat map overlays
      console.log('Loading 2D Mercator overlays...');
      graticuleRef.current = createGraticuleLines(pacificCentered, true); // true = isMercator
      graticuleRef.current.visible = latLonLines;
      sceneRef.current.add(graticuleRef.current);
      
      // Load 2D coasts
      if (coasts !== 'None') {
        loadCoasts(pacificCentered, true, coasts).then((coastsGroup) => {
          console.log(`2D Coasts loaded: ${coastsGroup.children.length} lines`);
          if (coastsRef.current && sceneRef.current) {
            sceneRef.current.remove(coastsRef.current);
          }
          coastsRef.current = coastsGroup;
          if (sceneRef.current) {
            sceneRef.current.add(coastsGroup);
          }
        });
      }
      
      // Load 2D rivers/lakes
      if (rivers !== 'None' || lakes !== 'None') {
        loadRiversAndLakes(pacificCentered, true, rivers, lakes).then((riversLakes) => {
          console.log(`2D Rivers/Lakes loaded: ${riversLakes.children.length} objects`);
          if (riversLakesRef.current && sceneRef.current) {
            sceneRef.current.remove(riversLakesRef.current);
          }
          riversLakesRef.current = riversLakes;
          if (sceneRef.current) {
            sceneRef.current.add(riversLakes);
          }
        });
      }
      
      // Load 2D countries
      if (countries === 'On') {
        loadCountryOutlines(pacificCentered, true).then((countriesGroup) => {
          console.log(`2D Countries loaded: ${countriesGroup.children.length} lines`);
          if (countriesRef.current && sceneRef.current) {
            sceneRef.current.remove(countriesRef.current);
          }
          countriesRef.current = countriesGroup;
          if (sceneRef.current) {
            sceneRef.current.add(countriesGroup);
          }
        });
      }
      
      controlsRef.current.update();
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      return;
    } else {
      // Switching back to 3D mode
      if (is2DMode) {
        console.log('Switching back to 3D mode');
        setIs2DMode(false);
        
        // Switch back to perspective camera
        cameraRef.current = camera3DRef.current;
        controlsRef.current.object = camera3DRef.current;
        
        // Restore 3D camera position if needed
        camera3DRef.current.position.set(4, 1, 4);
        camera3DRef.current.lookAt(0, 0, 0);
        camera3DRef.current.updateProjectionMatrix();
        
        // Update controls for 3D rotation
        controlsRef.current.enableRotate = true;
        controlsRef.current.enablePan = false;
        controlsRef.current.enableZoom = true;
        controlsRef.current.zoomSpeed = 0.5;
        controlsRef.current.minDistance = 3;
        controlsRef.current.maxDistance = 20;
        controlsRef.current.target.set(0, 0, 0);
        
        // Hide and clear plane
        if (planeRef.current) {
          planeRef.current.visible = false;
          planeRef.current.material.map = null;
          planeRef.current.material.needsUpdate = true;
        }
        
        // Show sphere with textures
        if (sphereRef.current) {
          sphereRef.current.visible = true;
          sphereRef.current.material.map = texture;
          sphereRef.current.material.normalMap = bumpTexture;
          sphereRef.current.material.normalScale = bumpTexture ? new THREE.Vector2(3.0, 3.0) : new THREE.Vector2(0, 0);
          sphereRef.current.material.needsUpdate = true;
        }
        
        // Remove 2D overlays and restore 3D geographic features
        if (graticuleRef.current) {
          sceneRef.current.remove(graticuleRef.current);
          graticuleRef.current.children.forEach((child) => {
            child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
        }
        if (coastsRef.current) {
          sceneRef.current.remove(coastsRef.current);
          coastsRef.current.children.forEach((child) => {
            child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
        }
        if (riversLakesRef.current) {
          sceneRef.current.remove(riversLakesRef.current);
          riversLakesRef.current.children.forEach((child) => {
            child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
        }
        if (countriesRef.current) {
          sceneRef.current.remove(countriesRef.current);
          countriesRef.current.children.forEach((child) => {
            child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
        }
        
        // Reload 3D spherical overlays
        console.log('Reloading 3D spherical overlays...');
        graticuleRef.current = createGraticuleLines(pacificCentered, false);
        graticuleRef.current.visible = latLonLines;
        sceneRef.current.add(graticuleRef.current);
        
        if (coasts !== 'None') {
          loadCoasts(pacificCentered, false, coasts).then((coastsGroup) => {
            if (coastsRef.current && sceneRef.current) {
              sceneRef.current.remove(coastsRef.current);
            }
            coastsRef.current = coastsGroup;
            if (sceneRef.current) {
              sceneRef.current.add(coastsGroup);
            }
          });
        }
        if (rivers !== 'None' || lakes !== 'None') {
          loadRiversAndLakes(pacificCentered, false, rivers, lakes).then((riversLakes) => {
            if (riversLakesRef.current && sceneRef.current) {
              sceneRef.current.remove(riversLakesRef.current);
            }
            riversLakesRef.current = riversLakes;
            if (sceneRef.current) {
              sceneRef.current.add(riversLakes);
            }
          });
        }
        if (countries === 'On') {
          loadCountryOutlines(pacificCentered, false).then((countriesGroup) => {
            if (countriesRef.current && sceneRef.current) {
              sceneRef.current.remove(countriesRef.current);
            }
            countriesRef.current = countriesGroup;
            if (sceneRef.current) {
              sceneRef.current.add(countriesGroup);
            }
          });
        }
        
        controlsRef.current.update();
      }
    }

    // Remove old assets
    if (graticuleRef.current) {
      sceneRef.current.remove(graticuleRef.current);
      graticuleRef.current.children.forEach((child) => {
        child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      graticuleRef.current = null;
    }
    if (coastsRef.current) {
      sceneRef.current.remove(coastsRef.current);
      coastsRef.current.children.forEach((child) => {
        child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      coastsRef.current = null;
    }
    if (riversLakesRef.current) {
      sceneRef.current.remove(riversLakesRef.current);
      riversLakesRef.current.children.forEach((child) => {
        child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      riversLakesRef.current = null;
    }
    if (countriesRef.current) {
      sceneRef.current.remove(countriesRef.current);
      countriesRef.current.children.forEach((child) => {
        child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      countriesRef.current = null;
    }

    // Update assets
    console.log(`Updating: coasts=${coasts}, rivers=${rivers}, lakes=${lakes}, countries=${countries || 'Off'}, pacificCentered=${pacificCentered}`);
    graticuleRef.current = createGraticuleLines(pacificCentered, false);
    graticuleRef.current.visible = latLonLines;
    sceneRef.current.add(graticuleRef.current);

    const loadPromises = [];
    if (coasts !== 'None') {
      loadPromises.push(loadCoasts(pacificCentered, false, coasts));
    } else {
      loadPromises.push(Promise.resolve(new THREE.Group()));
    }
    if (rivers !== 'None' || lakes !== 'None') {
      loadPromises.push(loadRiversAndLakes(pacificCentered, false, rivers, lakes));
    } else {
      loadPromises.push(Promise.resolve(new THREE.Group()));
    }
    if (countries === 'On') {
      loadPromises.push(loadCountryOutlines(pacificCentered, false));
    } else {
      loadPromises.push(Promise.resolve(new THREE.Group()));
    }

    Promise.all(loadPromises).then(([coastsGroup, riversLakes, countriesGroup]) => {
      console.log(`Coasts updated: ${coastsGroup.children.length} lines`);
      console.log(`Rivers and Lakes updated: ${riversLakes.children.length} objects`);
      console.log(`Countries updated: ${countriesGroup.children.length} lines`);
      
      // Remove existing features if they still exist (prevent duplicates)
      if (coastsRef.current && sceneRef.current) {
        sceneRef.current.remove(coastsRef.current);
      }
      if (riversLakesRef.current && sceneRef.current) {
        sceneRef.current.remove(riversLakesRef.current);
      }
      if (countriesRef.current && sceneRef.current) {
        sceneRef.current.remove(countriesRef.current);
      }
      
      coastsRef.current = coastsGroup;
      riversLakesRef.current = riversLakes;
      countriesRef.current = countriesGroup;
      
      if (sceneRef.current) {
        sceneRef.current.add(coastsGroup);
        sceneRef.current.add(riversLakes);
        sceneRef.current.add(countriesGroup);
      }

      if (texture) {
        texture.offset.x = textureOffsetX;
        texture.needsUpdate = true;
      }
      
      // Update appropriate mesh based on current mode
      if (is2DMode && planeRef.current && texture) {
        const flatTexture = texture.clone();
        flatTexture.offset.set(textureOffsetX, 0);
        flatTexture.repeat.set(1, 1);
        flatTexture.wrapS = THREE.RepeatWrapping;
        flatTexture.wrapT = THREE.ClampToEdgeWrapping;
        flatTexture.needsUpdate = true;
        planeRef.current.material.map = flatTexture;
        planeRef.current.material.needsUpdate = true;
      } else if (sphereRef.current) {
        sphereRef.current.material.map = texture;
        sphereRef.current.material.needsUpdate = true;
      }

      cameraRef.current.position.copy(currentPosition.normalize().multiplyScalar(distance));
      controlsRef.current.target.copy(currentTarget);
      cameraRef.current.lookAt(controlsRef.current.target);
      cameraRef.current.updateProjectionMatrix();
      controlsRef.current.update();

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    });

    if (globeView === '3D') {
      if (!(cameraRef.current instanceof THREE.PerspectiveCamera)) {
        cameraRef.current = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        controlsRef.current.object = cameraRef.current;
        sceneRef.current.add(cameraRef.current);
      } else {
        cameraRef.current.fov = 60;
        cameraRef.current.updateProjectionMatrix();
      }
      sphereRef.current.material.wireframe = false;
      sphereRef.current.visible = true;
      controlsRef.current.minDistance = 2.5;
      controlsRef.current.maxDistance = 25;
      controlsRef.current.zoomSpeed = 0.8;
      controlsRef.current.enablePan = false;
      controlsRef.current.enableRotate = true;
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.1;
      controlsRef.current.rotateSpeed = 0.6;
      sceneRef.current.rotation.set(0, 0, 0);
    } else if (globeView === '3D Orthographic') {
      if (!(cameraRef.current instanceof THREE.PerspectiveCamera)) {
        cameraRef.current = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        controlsRef.current.object = cameraRef.current;
        sceneRef.current.add(cameraRef.current);
      } else {
        cameraRef.current.fov = 45;
        cameraRef.current.updateProjectionMatrix();
      }
      sphereRef.current.material.wireframe = false;
      sphereRef.current.visible = true;
      controlsRef.current.minDistance = 3;
      controlsRef.current.maxDistance = 20;
      controlsRef.current.zoomSpeed = 0.5;
      controlsRef.current.enablePan = false;
      controlsRef.current.enableRotate = true;
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.1;
      controlsRef.current.rotateSpeed = 0.5;
      sceneRef.current.rotation.set(0, 0, 0);
    }
  }, [
    graphicalSettings.globeView,
    graphicalSettings.pacificCentered,
    graphicalSettings.rivers,
    graphicalSettings.lakes,
    graphicalSettings.coasts,
    graphicalSettings.latLonLines,
    graphicalSettings.countries,
    textureOffsetX,
  ]);

  useEffect(() => {
    if (graticuleRef.current) {
      graticuleRef.current.visible = graphicalSettings.latLonLines;
    }
  }, [graphicalSettings.latLonLines]);

  const handleTimeSeriesClick = useCallback((event) => {
    event.stopPropagation(); // Prevent click from bubbling to canvas
    console.log('Timeseries button clicked');
    console.log('Current clickInfo:', clickInfo);
    if (clickInfo) {
      setOpenTimeSeries(true);
      console.log('Set openTimeSeries to true');
      console.log('Opening timeseries modal with props:', {
        lat: clickInfo.rawLat,
        lon: clickInfo.rawLon,
        varName: clickInfo.varName,
        units: clickInfo.units,
        dataset: clickInfo.dataset,
      });
    } else {
      console.log('No clickInfo available, cannot open timeseries');
    }
  }, [clickInfo]);

  const handleCloseTimeSeries = useCallback(() => {
    console.log('Closing timeseries modal');
    setOpenTimeSeries(false);
  }, []);

  const handleLevelChange = useCallback((event) => {
    setSelectedLevel(event.target.value);
  }, [setSelectedLevel]);

  return (
    <div
      id="globe-container"
      ref={mountRef}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '28px',
        height: '100vh',
        backgroundColor: 'white',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {clickInfo && (
        <Box
          id="ui-panel"
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: 3,
            borderRadius: 2,
            boxShadow: 3,
            zIndex: 1000,
            minWidth: 250,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
            {clickInfo.dataset}: {clickInfo.value} {clickInfo.units}
          </Typography>
          <Typography variant="body1">Lat: {clickInfo.lat}</Typography>
          <Typography variant="body1">Lon: {clickInfo.lon}</Typography>
          <Box sx={{ mt: 2 }} />
          {metadata.multilevel ? (
            <FormControl fullWidth sx={{ mb: 1 }}>
              <InputLabel>Level</InputLabel>
              <Select value={selectedLevel || ''} onChange={handleLevelChange} label="Level">
                {metadata.levels?.map((level) => (
                  <MenuItem key={level} value={level}>
                    {level} mb
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Typography variant="body1" sx={{ mb: 1 }}>
              Level: Single Level
            </Typography>
          )}
          <Button
            variant="contained"
            size="medium"
            sx={{ mt: 1 }}
            onClick={handleTimeSeriesClick}
            disabled={!clickInfo}
          >
            Timeseries
          </Button>
        </Box>
      )}
      {clickInfo && (
        <>
          {console.log('Rendering TimeSeries, open:', openTimeSeries, 'props:', { lat: clickInfo.rawLat, lon: clickInfo.rawLon })}
          <TimeSeries
            open={openTimeSeries}
            onClose={handleCloseTimeSeries}
            lat={clickInfo.rawLat}
            lon={clickInfo.rawLon}
            varName={clickInfo.varName}
            units={clickInfo.units}
            datasetName={clickInfo.dataset}
          />
        </>
      )}

      {colorbar.gradient && (
        <Box
          sx={{
            position: 'absolute',
            right: 16,
            top: 120,
            width: 28,
            height: 240,
            borderRadius: 1,
            boxShadow: 3,
            backgroundImage: colorbar.gradient,
            border: '1px solid rgba(0,0,0,0.2)',
            zIndex: 900,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingY: 1,
            cursor: 'pointer',
          }}
          onClick={() => setColorMapOpen(true)}
          aria-label="Open colormap menu"
        >
          <Typography variant="caption" sx={{ color: '#000', fontWeight: 600 }}>
            {Number.isFinite(colorbar.max) ? colorbar.max.toFixed(2) : ''}
          </Typography>
          <Typography variant="caption" sx={{ color: '#000', fontWeight: 600 }}>
            {Number.isFinite(colorbar.min) ? colorbar.min.toFixed(2) : ''}
          </Typography>
        </Box>
      )}

      <ColorMapMenu
        open={colorMapOpen}
        onClose={() => setColorMapOpen(false)}
        onSelect={(name) => {
          setColormap(name);
          setColorMapOpen(false);
        }}
      />
    </div>
  );
};

// Export memoized component
export default memo(GlobeWireframe, () => true);