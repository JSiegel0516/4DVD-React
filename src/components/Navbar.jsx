import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Button,
  Drawer,
  List,
  ListItem,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  Radio,
  FormControlLabel,
  Divider,
  Stack,
  Tooltip,
} from '@mui/material';
import { Link } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useGlobeSettings } from '../components/GlobeSettingsContext';

export default function Navbar({ onAboutClick }) {
  const [open, setOpen] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [groupedDatasets, setGroupedDatasets] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metadataCache, setMetadataCache] = useState({});
  const [datasetModalOpen, setDatasetModalOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedLayers, setExpandedLayers] = useState({});
  const { selectedDataset, setSelectedDataset, selectedDate, selectedLevel, metadata, graphicalSettings } = useGlobeSettings();
  const datasetsFetchedRef = useRef(false);

  const cleanLabel = (text = '') => text.replace(/\s*\(.*?\)/g, '').replace(/Dataset[:\s-]*/i, '').trim();
  const simplifyChild = (text = '', parent = '') => {
    const cleaned = cleanLabel(text);
    if (!parent) return cleaned;
    const parentClean = cleanLabel(parent);
    const regex = new RegExp(`^${parentClean}\s*[-|:]*\s*`, 'i');
    const stripped = cleaned.replace(regex, '').trim();
    return stripped || cleaned;
  };

  const getDatasetKey = (dataset) => {
    const fromPath = dataset.relative_path?.split(/[\\/]/)?.[0];
    return cleanLabel(fromPath || dataset.dataset_name || 'Dataset');
  };

  const getLayerKey = (dataset) => {
    const raw = dataset.layer_name;
    if (!raw || cleanLabel(raw) === cleanLabel(dataset.dataset_name)) return 'Single Level';
    return simplifyChild(raw, dataset.dataset_name) || 'Single Level';
  };

  const getStatKey = (dataset) => {
    const raw = dataset.stat_level;
    const metaDisplay = dataset.metadata?.display_name || dataset.metadata?.chosen_variable;
    const stat = cleanLabel(raw) || cleanLabel(metaDisplay) || 'Value';
    return stat;
  };

  const buildGrouped = useCallback((list, cache) => {
    const grouped = {};
    list.forEach((dataset) => {
      const meta = cache[dataset.relative_path] || dataset.metadata || {};
      const merged = { ...dataset, metadata: meta };
      const datasetKey = getDatasetKey(merged);
      const layerKey = getLayerKey(merged);
      const statKey = getStatKey(merged);

      if (!grouped[datasetKey]) grouped[datasetKey] = {};
      if (!grouped[datasetKey][layerKey]) grouped[datasetKey][layerKey] = {};
      grouped[datasetKey][layerKey][statKey] = merged;
    });
    return grouped;
  }, []);

  const fetchDatasetInfo = useCallback(async (dataset) => {
    if (!dataset?.relative_path) return null;
    const path = dataset.relative_path;
    if (metadataCache[path]) return metadataCache[path];
    try {
      const res = await fetch(`/api/dataset_info?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error(`Failed to fetch dataset info for ${path}`);
      const info = await res.json();
      setMetadataCache((prev) => ({ ...prev, [path]: info }));
      return info;
    } catch (err) {
      console.error('Error fetching dataset info for', path, err);
      return null;
    }
  }, [metadataCache]);

  // Debug selectedDataset
  useEffect(() => {
    console.log('Selected dataset:', selectedDataset);
  }, [selectedDataset]);

  // Fetch datasets and metadata
  useEffect(() => {
    if (datasetsFetchedRef.current) return;
    datasetsFetchedRef.current = true;
    setLoading(true);
    fetch('/api/datasets')
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch datasets: ${response.statusText}`);
        return response.json();
      })
      .then(async (data) => {
        console.log('Fetched datasets:', data);
        setError(null);
        setDatasets(data);
        setGroupedDatasets(buildGrouped(data, metadataCache));
        setLoading(false);

        // Prefetch default dataset metadata lazily
        if (data.length > 0 && !selectedDataset) {
          const defaultDataset = data.find((d) =>
            d.relative_path.includes('GPCP V2.3 Precipitation') &&
            d.stat_level.includes('Monthly Mean (Surface)')
          ) || data[0];
          const info = await fetchDatasetInfo(defaultDataset);
          if (info) {
            setSelectedDataset({
              name: info.chosen_variable,
              long_name: info.chosen_variable,
              units: info.units || 'unknown',
              relative_path: defaultDataset.relative_path,
              dataset_name: defaultDataset.dataset_name, // already a cleaned display name from backend
            });
          }
        }
      })
      .catch((error) => {
        console.error('Error fetching datasets from FastAPI API:', error);
        setError('Failed to load datasets. Please try again later.');
        setLoading(false);
      });
  }, []);

  // Handle menu open/close
  const handleDatasetsClick = () => {
    setDatasetModalOpen(true);
  };

  const handleMenuClose = () => {
    setDatasetModalOpen(false);
  };

  // Handle dataset selection
  const handleDatasetSelect = async (dataset) => {
    console.log('Selected dataset:', dataset);
    const meta = dataset.metadata?.chosen_variable ? dataset.metadata : await fetchDatasetInfo(dataset);
    if (!meta) return;
    setSelectedDataset({
      name: meta.chosen_variable,
      long_name: meta.chosen_variable,
      units: meta.units || 'unknown',
      relative_path: dataset.relative_path,
      dataset_name: dataset.dataset_name, // use backend-provided display name
    });
    handleMenuClose();
  };

  const toggleCategory = (name) => {
    setExpandedCategories((prev) => ({ ...prev, [name]: !prev[name] }));
    if (!expandedCategories[name]) {
      // Lazy load metadata for all datasets under this category
      const toFetch = datasets.filter((d) => getDatasetKey(d) === name);
      toFetch.forEach((d) => fetchDatasetInfo(d));
    }
  };

  const toggleLayer = (category, layer) => {
    const key = `${category}__${layer}`;
    setExpandedLayers((prev) => ({ ...prev, [key]: !prev[key] }));
    if (!expandedLayers[key]) {
      const toFetch = datasets.filter((d) => getDatasetKey(d) === category && getLayerKey(d) === (layer || 'Single Level'));
      toFetch.forEach((d) => fetchDatasetInfo(d));
    }
  };

  const sanitizeFileName = (name) =>
    String(name || 'dataset')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .trim();

  const toCsvCell = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const handleDownloadData = useCallback(async () => {
    if (!selectedDataset || !selectedDate) {
      window.alert('Please select a dataset and date first.');
      return;
    }

    try {
      const levelParam = metadata?.multilevel && selectedLevel ? `&level=${selectedLevel}` : '';
      const center = graphicalSettings?.pacificCentered ? 'pacific' : 'atlantic';
      const url = `/api/slice?path=${encodeURIComponent(selectedDataset.relative_path)}&variable=${encodeURIComponent(selectedDataset.name)}&date=${encodeURIComponent(selectedDate)}&center=${center}${levelParam}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      const lats = Array.isArray(payload?.lats) ? payload.lats : [];
      const lons = Array.isArray(payload?.lons) ? payload.lons : [];
      const values = Array.isArray(payload?.values) ? payload.values : [];

      if (!lats.length || !lons.length || !values.length) {
        throw new Error('No grid data available for this selection.');
      }

      const valueHeader = selectedDataset.long_name || selectedDataset.name || 'Value';
      const levelHeader = metadata?.multilevel ? `Level [${metadata?.level_units || 'level'}]` : 'Level';
      const levelValue = metadata?.multilevel ? selectedLevel : 'Single Level';
      const dateValue = String(selectedDate).length >= 7 ? String(selectedDate).slice(0, 7) : selectedDate;

      const rows = [['Latitude', 'Longitude', valueHeader, levelHeader, 'Date']];
      for (let i = 0; i < lats.length; i += 1) {
        const row = Array.isArray(values[i]) ? values[i] : [];
        for (let j = 0; j < lons.length; j += 1) {
          const v = row[j];
          rows.push([
            lats[i],
            lons[j],
            Number.isFinite(v) ? v : '',
            levelValue ?? '',
            dateValue,
          ]);
        }
      }

      const csv = rows.map((r) => r.map(toCsvCell).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${sanitizeFileName(selectedDataset.dataset_name || selectedDataset.name)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Download data failed:', err);
      window.alert(err.message || 'Failed to download CSV.');
    }
  }, [selectedDataset, selectedDate, selectedLevel, metadata, graphicalSettings]);

  const navLinks = [
    { label: 'Top Datasets', path: '/datasets' },
    { label: 'Datasets', path: '#', onClick: handleDatasetsClick },
    { label: 'Download Data', path: '#', onClick: handleDownloadData },
    { label: 'About', path: '#', onClick: onAboutClick },
  ];

  // Rebuild grouped tree whenever datasets or metadata cache changes
  useEffect(() => {
    setGroupedDatasets(buildGrouped(datasets, metadataCache));
  }, [datasets, metadataCache, buildGrouped]);

  return (
    <>
      <AppBar position="fixed" color="primary" sx={{ bgcolor: '#0288D1', zIndex: 1300 }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setOpen(true)}
            sx={{ display: { sm: 'none' } }}
            aria-label="menu"
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 1 }}>
            4DVD (4-Dimensional Visual Delivery of Big Climate Data)
          </Typography>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            {navLinks.map(({ label, path, onClick }) => (
              <Button
                key={label}
                color="inherit"
                component={path === '#' ? 'button' : Link}
                to={path !== '#' ? path : undefined}
                onClick={onClick}
                startIcon={label === 'About' ? <InfoOutlinedIcon /> : null}
                sx={{ fontSize: '1rem', fontWeight: 'bold', mx: 5 }}
              >
                {label}
              </Button>
            ))}
          </Box>
        </Toolbar>
      </AppBar>

      {error && (
        <Box sx={{ position: 'absolute', top: 80, ml: { xs: 6, sm: 7 }, zIndex: 1100, color: 'red' }}>
          <Typography variant="h6">{error}</Typography>
        </Box>
      )}

      {selectedDataset && !error && (
        <Box
          sx={{
            position: 'absolute',
            top: 80,
            ml: { xs: 6, sm: 7 },
            zIndex: 1100,
            display: 'block',
          }}
          onClick={handleDatasetsClick}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              color: 'black',
              fontSize: '1.3rem',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {selectedDataset.dataset_name} | {selectedDataset.long_name || selectedDataset.name} ({selectedDataset.units})
          </Typography>
        </Box>
      )}

      <Drawer anchor="left" open={open} onClose={() => setOpen(false)}>
        <List sx={{ width: 250 }}>
          {navLinks.map(({ label, path, onClick }) => (
            <ListItem
              button
              key={label}
              component={path === '#' ? 'button' : Link}
              to={path !== '#' ? path : undefined}
              onClick={() => {
                setOpen(false);
                if (onClick) onClick();
              }}
            >
              {label === 'About' && <InfoOutlinedIcon sx={{ mr: 1 }} />}
              {label}
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Dialog
        open={datasetModalOpen}
        onClose={handleMenuClose}
        fullWidth
        maxWidth="md"
        aria-labelledby="dataset-dialog-title"
      >
        <DialogTitle id="dataset-dialog-title">Select Dataset & Layer</DialogTitle>
        <DialogContent dividers sx={{ maxHeight: '70vh', p: 2 }}>
          {loading ? (
            <Typography variant="body1">Loading datasets...</Typography>
          ) : Object.keys(groupedDatasets).length > 0 ? (
            <Stack spacing={1}>
              {Object.entries(groupedDatasets).map(([datasetName, layers]) => {
                const catExpanded = expandedCategories[datasetName] ?? false;
                const datasetLabel = cleanLabel(datasetName) || datasetName || 'Dataset';
                return (
                  <Box key={datasetName}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton size="small" onClick={() => toggleCategory(datasetName)}>
                        {catExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <Tooltip title={datasetName !== datasetLabel ? datasetName : ''} placement="right">
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {datasetLabel || datasetName}
                        </Typography>
                      </Tooltip>
                    </Box>

                    {catExpanded && (
                      <Stack spacing={1} sx={{ pl: 4, pt: 1 }}>
                        {Object.entries(layers).map(([layerName, stats]) => {
                          const statsEntries = Object.entries(stats);
                          const layerKey = `${datasetName}__${layerName}`;
                          const layerExpanded = expandedLayers[layerKey] ?? false;
                          const layerLabel = simplifyChild(layerName || 'Single Level', datasetName) || 'Single Level';

                          return (
                            <Box key={layerKey}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <IconButton size="small" onClick={() => toggleLayer(datasetName, layerName)}>
                                  {layerExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </IconButton>
                                <Tooltip title={layerName !== layerLabel ? layerName : ''} placement="right">
                                  <Typography variant="subtitle2" sx={{ fontStyle: 'italic' }}>
                                    {layerLabel || layerName}
                                  </Typography>
                                </Tooltip>
                              </Box>
                              {layerExpanded && (
                                <Stack spacing={0.5} sx={{ pl: 4, pt: 0.5 }}>
                                  {statsEntries.map(([statLevel, dataset]) => {
                                    const selected = selectedDataset?.relative_path === dataset.relative_path;
                                    const statLabel = simplifyChild(statLevel || 'Value', layerName || layerLabel) || 'Value';
                                    const units = dataset.metadata?.units || 'units';
                                    return (
                                      <FormControlLabel
                                        key={`${layerKey}__${statLevel}`}
                                        control={
                                          <Radio
                                            checked={selected}
                                            onChange={() => handleDatasetSelect(dataset)}
                                            value={dataset.relative_path}
                                            name="dataset-choice"
                                          />
                                        }
                                        label={
                                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                              {statLabel || statLevel}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              {units}
                                            </Typography>
                                          </Box>
                                        }
                                      />
                                    );
                                  })}
                                </Stack>
                              )}
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                    <Divider sx={{ my: 1 }} />
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body1">No datasets available</Typography>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}