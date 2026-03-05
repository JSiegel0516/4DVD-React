import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Box, Typography, Button, FormControl, FormGroup, FormControlLabel, Switch, Radio, RadioGroup, FormLabel, Divider, Menu, MenuItem, InputLabel, Select } from '@mui/material';
import { Palette as PaletteIcon } from '@mui/icons-material';
import { useGlobeSettings } from './GlobeSettingsContext';
import ColorMapMenu from './ColorMapMenu';

// Memoize to prevent rerenders unless props change
function TabsContent({ tabValue }) {
  const { graphicalSettings, updateGraphicalSettings, selectedDataset, setSelectedDataset, colorMapOpen, setColorMapOpen, setColormap } = useGlobeSettings();
  const [anchorEl, setAnchorEl] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [groupedDatasets, setGroupedDatasets] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Handle switch toggle for context settings
  const handleContextSwitchChange = useCallback((event) => {
    const { name, checked } = event.target;
    if (graphicalSettings[name] !== checked) {
      updateGraphicalSettings({ [name]: checked });
    }
  }, [graphicalSettings, updateGraphicalSettings]);

  // Handle radio change for context settings
  const handleContextRadioChange = useCallback((event, key) => {
    const value = event.target.value;
    if (graphicalSettings[key] !== value) {
      updateGraphicalSettings({ [key]: value });
    }
  }, [graphicalSettings, updateGraphicalSettings]);

  // Fetch datasets
  useEffect(() => {
    setLoading(true);
    fetch('/datasets')
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch datasets: ${response.statusText}`);
        return response.json();
      })
      .then(async (data) => {
        console.log('Fetched datasets:', data);
        setError(null);

        const datasetPromises = data.map((dataset) =>
          fetch(`/dataset_info?path=${encodeURIComponent(dataset.relative_path)}`)
            .then((response) => {
              if (!response.ok) throw new Error(`Failed to fetch dataset info for ${dataset.relative_path}`);
              return response.json();
            })
            .then((info) => ({
              ...dataset,
              metadata: info,
            }))
            .catch((error) => {
              console.error(`Error fetching dataset info for ${dataset.relative_path}:`, error);
              return { ...dataset, metadata: { units: 'unknown' } };
            })
        );

        const datasetsWithMetadata = await Promise.all(datasetPromises);

        const grouped = {};
        datasetsWithMetadata.forEach((dataset) => {
          const { dataset_name, layer_name, stat_level } = dataset;
          if (!grouped[dataset_name]) grouped[dataset_name] = {};
          if (!grouped[dataset_name][layer_name]) grouped[dataset_name][layer_name] = {};
          grouped[dataset_name][layer_name][stat_level] = dataset;
        });

        setDatasets(datasetsWithMetadata);
        setGroupedDatasets(grouped);
        setLoading(false);

        // Only set default dataset if none is selected
        if (datasetsWithMetadata.length > 0 && !selectedDataset) {
          const defaultDataset = datasetsWithMetadata.find((d) =>
            d.relative_path.includes('GPCP V2.3 Precipitation') &&
            d.stat_level.includes('Monthly Mean (Surface)')
          ) || datasetsWithMetadata[0];
          setSelectedDataset({
            name: defaultDataset.metadata?.chosen_variable || defaultDataset.dataset_name,
            long_name: defaultDataset.metadata?.chosen_variable || defaultDataset.dataset_name,
            units: defaultDataset.metadata?.units || 'unknown',
            relative_path: defaultDataset.relative_path,
            dataset_name: defaultDataset.dataset_name,
          });
        }
      })
      .catch((error) => {
        console.error('Error fetching datasets:', error);
        setError('Failed to load datasets. Please try again later.');
        setLoading(false);
      });
  }, [setSelectedDataset, selectedDataset]);

  // Handle dataset menu open/close
  const handleDatasetsClick = useCallback((event) => {
    console.log('Datasets clicked, currentTarget:', event.currentTarget);
    if (event.currentTarget) {
      setAnchorEl(event.currentTarget);
    }
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  // Handle dataset selection
  const handleDatasetSelect = useCallback((dataset) => {
    const newDataset = {
      name: dataset.metadata.chosen_variable,
      long_name: dataset.metadata.chosen_variable,
      units: dataset.metadata.units || 'unknown',
      relative_path: dataset.relative_path,
      dataset_name: dataset.dataset_name,
    };
    if (JSON.stringify(newDataset) !== JSON.stringify(selectedDataset)) {
      setSelectedDataset(newDataset);
      // Date is reset in GlobeSettingsContext when dataset changes
    }
    handleMenuClose();
  }, [selectedDataset, setSelectedDataset, handleMenuClose]);

  return (
    <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
      {tabValue === 0 && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Select Datasets
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              color: 'black',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
              mb: 2,
            }}
            onClick={handleDatasetsClick}
          >
            {selectedDataset
              ? `${selectedDataset.dataset_name} | ${selectedDataset.long_name} (${selectedDataset.units})`
              : 'Select Dataset'}
          </Typography>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl && document.body.contains(anchorEl))}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            {loading ? (
              <MenuItem disabled>Loading datasets...</MenuItem>
            ) : Object.keys(groupedDatasets).length > 0 ? (
              Object.entries(groupedDatasets).map(([datasetName, layers]) => (
                <div key={datasetName}>
                  <MenuItem disabled sx={{ fontWeight: 'bold' }}>
                    {datasetName}
                  </MenuItem>
                  {Object.entries(layers).map(([layerName, stats]) => (
                    <div key={layerName}>
                      <MenuItem disabled sx={{ pl: 4, fontStyle: 'italic' }}>
                        {layerName}
                      </MenuItem>
                      {Object.entries(stats).map(([statLevel, dataset]) => (
                        <MenuItem
                          key={statLevel}
                          onClick={() => handleDatasetSelect(dataset)}
                          sx={{ pl: 8 }}
                        >
                          {statLevel} ({dataset.metadata?.units || 'no units'})
                        </MenuItem>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <MenuItem disabled>No datasets available</MenuItem>
            )}
          </Menu>
        </Box>
      )}
      {tabValue === 1 && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Date
          </Typography>
          <Typography variant="body1">
            Date selection is handled via the Date Selector component.
          </Typography>
        </Box>
      )}
      {tabValue === 2 && (
        <Box sx={{ p: 2, overflowY: 'auto' }}>
          <Typography variant="h6" gutterBottom>
            Graphical Settings
          </Typography>
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<PaletteIcon />}
              onClick={() => setColorMapOpen(true)}
              sx={{
                bgcolor: '#0288D1',
                '&:hover': { bgcolor: '#0277BD' },
                textTransform: 'none',
              }}
            >
              ColorMaps
            </Button>
          </Box>
          <FormGroup sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={graphicalSettings.pacificCentered}
                  onChange={handleContextSwitchChange}
                  name="pacificCentered"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#9c27b0' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#9c27b0' },
                  }}
                />
              }
              label="Pacific Centered"
              sx={{ mx: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={graphicalSettings.latLonLines}
                  onChange={handleContextSwitchChange}
                  name="latLonLines"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#9c27b0' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#9c27b0' },
                  }}
                />
              }
              label="Lat/Lon Lines"
              sx={{ mx: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={graphicalSettings.smoothedGridboxes}
                  onChange={handleContextSwitchChange}
                  name="smoothedGridboxes"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#9c27b0' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#9c27b0' },
                  }}
                />
              }
              label="Smoothed Gridboxes"
              sx={{ mx: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={graphicalSettings.geographicalLines}
                  onChange={handleContextSwitchChange}
                  name="geographicalLines"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#9c27b0' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#9c27b0' },
                  }}
                />
              }
              label="Geographical Lines"
              sx={{ mx: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={graphicalSettings.timezones}
                  onChange={handleContextSwitchChange}
                  name="timezones"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#9c27b0' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#9c27b0' },
                  }}
                />
              }
              label="Timezones"
              sx={{ mx: 1 }}
            />
          </FormGroup>
          <Divider sx={{ my: 2 }} />
          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel component="legend" sx={{ fontSize: '1.1rem', mb: 1 }}>
              Bump Mapping
            </FormLabel>
            <RadioGroup
              value={graphicalSettings.bumpMapping}
              onChange={(e) => handleContextRadioChange(e, 'bumpMapping')}
              name="bump-mapping"
            >
              {['Land', 'Land & Bathymetry', 'None'].map((option) => (
                <FormControlLabel
                  key={option}
                  value={option}
                  control={<Radio sx={{ color: '#FFD600', '&.Mui-checked': { color: '#FFD600' } }} />}
                  label={option}
                  sx={{ mx: 1 }}
                />
              ))}
            </RadioGroup>
          </FormControl>
          <Divider sx={{ my: 2 }} />
          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel component="legend" sx={{ fontSize: '1.1rem', mb: 1 }}>
              Globe View
            </FormLabel>
            <RadioGroup
              value={graphicalSettings.globeView}
              onChange={(e) => handleContextRadioChange(e, 'globeView')}
              name="globe-view"
            >
              {['3D', '3D Orthographic', '2D Mercator'].map((option) => (
                <FormControlLabel
                  key={option}
                  value={option}
                  control={<Radio sx={{ color: '#FFD600', '&.Mui-checked': { color: '#FFD600' } }} />}
                  label={option}
                  sx={{ mx: 1 }}
                />
              ))}
            </RadioGroup>
          </FormControl>
          <Divider sx={{ my: 2 }} />
          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel component="legend" sx={{ fontSize: '1.1rem', mb: 1 }}>
              Coasts
            </FormLabel>
            <RadioGroup
              value={graphicalSettings.coasts}
              onChange={(e) => handleContextRadioChange(e, 'coasts')}
              name="coasts"
            >
              {['Low', 'Medium', 'High', 'None'].map((option) => (
                <FormControlLabel
                  key={option}
                  value={option}
                  control={<Radio sx={{ color: '#FFD600', '&.Mui-checked': { color: '#FFD600' } }} />}
                  label={option}
                  sx={{ mx: 1 }}
                />
              ))}
            </RadioGroup>
          </FormControl>
          <Divider sx={{ my: 2 }} />
          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel component="legend" sx={{ fontSize: '1.1rem', mb: 1 }}>
              Rivers
            </FormLabel>
            <RadioGroup
              value={graphicalSettings.rivers}
              onChange={(e) => handleContextRadioChange(e, 'rivers')}
              name="rivers"
            >
              {['Low', 'Medium', 'High', 'None'].map((option) => (
                <FormControlLabel
                  key={option}
                  value={option}
                  control={<Radio sx={{ color: '#FFD600', '&.Mui-checked': { color: '#FFD600' } }} />}
                  label={option}
                  sx={{ mx: 1 }}
                />
              ))}
            </RadioGroup>
          </FormControl>
          <Divider sx={{ my: 2 }} />
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ fontSize: '1.1rem', mb: 1 }}>
              Lakes
            </FormLabel>
            <RadioGroup
              value={graphicalSettings.lakes}
              onChange={(e) => handleContextRadioChange(e, 'lakes')}
              name="lakes"
            >
              {['Low', 'Medium', 'High', 'None'].map((option) => (
                <FormControlLabel
                  key={option}
                  value={option}
                  control={<Radio sx={{ color: '#FFD600', '&.Mui-checked': { color: '#FFD600' } }} />}
                  label={option}
                  sx={{ mx: 1 }}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>
      )}
      {tabValue === 3 && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Info
          </Typography>
          <Typography>Mock info content (TBD)</Typography>
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
    </Box>
  );
}

export default memo(TabsContent, (prevProps, nextProps) => {
  return prevProps.tabValue === nextProps.tabValue;
});