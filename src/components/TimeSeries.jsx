import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Menu, MenuItem, Typography, FormControl, FormGroup, FormControlLabel, Checkbox, Table, TableContainer, TableHead, TableRow, TableCell, TableBody, Paper, Card, CardContent, Box } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useGlobeSettings } from './GlobeSettingsContext';
import LinearTrend from './LinearTrend';
import HistogramViewer from './HistogramViewer';
import ClimatologyViewer from './ClimatologyViewer';
import SeasonalTimeseries from './SeasonalTimeseries';

// StatisticsDialog Component
function StatisticsDialog({ open, onClose, lat, lon, varName, units, datasetName, level, metadata }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const { selectedDataset } = useGlobeSettings();

  useEffect(() => {
    if (!open || !selectedDataset || !lat || !lon || !varName) {
      setStats(null);
      setError(null);
      return;
    }

    const fetchStatistics = async () => {
      try {
        const levelParam = metadata.multilevel && level !== 'none' ? `&level=${level}` : '';
        const response = await fetch(
          `/point_statistics?path=${encodeURIComponent(selectedDataset.relative_path)}&lat=${lat}&lon=${lon}&variable=${varName}${levelParam}`
        );
        if (!response.ok) throw new Error(`Failed to fetch statistics: ${response.status} ${response.statusText}`);
        const data = await response.json();
        console.log('Fetched statistics:', data);
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching statistics:', err);
        setError(`Failed to load statistics: ${err.message}`);
        setStats(null);
      }
    };

    fetchStatistics();
  }, [open, lat, lon, varName, selectedDataset, level, metadata.multilevel]);

  const levelDisplay = metadata.multilevel && level !== 'none'
    ? `${level} ${(metadata.level_units || 'mb').replace('millibar', 'mb')}`
    : 'Single Level';

  const statRow = stats ? Object.values(stats)[0] : null;

  const handleSaveStatistics = () => {
    if (!statRow) return;

    const csvRows = [
      ['Statistic', 'Value'],
      ['Min', statRow.Min?.toFixed(2) ?? statRow.min?.toFixed(2) ?? 'N/A'],
      ['25%', statRow['25%']?.toFixed(2) ?? 'N/A'],
      ['50%', statRow['50%']?.toFixed(2) ?? 'N/A'],
      ['Mean', statRow.Mean?.toFixed(2) ?? statRow.mean?.toFixed(2) ?? 'N/A'],
      ['75%', statRow['75%']?.toFixed(2) ?? 'N/A'],
      ['Max', statRow.Max?.toFixed(2) ?? statRow.max?.toFixed(2) ?? 'N/A'],
      ['Standard Deviation', statRow.Std?.toFixed(2) ?? statRow.std?.toFixed(2) ?? 'N/A'],
      ['Var', statRow.Var?.toFixed(2) ?? statRow.var?.toFixed(2) ?? 'N/A'],
      ['Skewness', statRow.Skewness?.toFixed(2) ?? statRow.skewness?.toFixed(2) ?? 'N/A'],
      ['Kurtosis', statRow.Kurtosis?.toFixed(2) ?? statRow.kurtosis?.toFixed(2) ?? 'N/A'],
    ];

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statistics_${varName}_${lat.toFixed(2)}_N_${lon.toFixed(2)}_${lon >= 0 ? 'E' : 'W'}_${levelDisplay.replace(' ', '_')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{ '& .MuiDialog-paper': { minHeight: '400px', maxHeight: '80vh' } }}
    >
      <DialogTitle
        sx={{
          backgroundColor: '#1976d2',
          color: 'white',
          fontWeight: 'bold',
          padding: '16px',
          textAlign: 'center',
        }}
      >
        Statistics Summary for {varName} at ({lat.toFixed(2)}°N, {lon.toFixed(2)}°{lon >= 0 ? 'E' : 'W'}) - {datasetName}
      </DialogTitle>
      <DialogContent sx={{ padding: '24px' }}>
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        {statRow ? (
          <Card sx={{ boxShadow: 3, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1976d2' }}>
                Level: {levelDisplay}
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: '300px', overflowY: 'auto' }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', color: '#0D47A1' }}>Statistic</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', color: '#0D47A1' }}>Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0D47A1', textAlign: 'left' }}>Min</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>{statRow.Min?.toFixed(2) ?? statRow.min?.toFixed(2) ?? 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0D47A1', textAlign: 'left' }}>25%</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>{statRow['25%']?.toFixed(2) ?? 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0D47A1', textAlign: 'left' }}>50%</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>{statRow['50%']?.toFixed(2) ?? 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0D47A1', textAlign: 'left' }}>Mean</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>{statRow.Mean?.toFixed(2) ?? statRow.mean?.toFixed(2) ?? 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0D47A1', textAlign: 'left' }}>75%</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>{statRow['75%']?.toFixed(2) ?? 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0D47A1', textAlign: 'left' }}>Max</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>{statRow.Max?.toFixed(2) ?? statRow.max?.toFixed(2) ?? 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0D47A1', textAlign: 'left' }}>Standard Deviation</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>{statRow.Std?.toFixed(2) ?? statRow.std?.toFixed(2) ?? 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0D47A1', textAlign: 'left' }}>Var</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>{statRow.Var?.toFixed(2) ?? statRow.var?.toFixed(2) ?? 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0D47A1', textAlign: 'left' }}>Skewness</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>{statRow.Skewness?.toFixed(2) ?? statRow.skewness?.toFixed(2) ?? 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#0D47A1', textAlign: 'left' }}>Kurtosis</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>{statRow.Kurtosis?.toFixed(2) ?? statRow.kurtosis?.toFixed(2) ?? 'N/A'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        ) : (
          <Typography>Loading statistics...</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ padding: '16px', justifyContent: 'space-between' }}>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
        <Button
          onClick={handleSaveStatistics}
          variant="contained"
          color="secondary"
          disabled={!statRow}
        >
          Save Statistics
        </Button>
      </DialogActions>
    </Dialog>
  );
}


function TimeSeries({ open, onClose, lat, lon, varName, units, datasetName }) {
  const [chartData, setChartData] = useState([]);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [computingAnchorEl, setComputingAnchorEl] = useState(null);
  const [seasonalAnchorEl, setSeasonalAnchorEl] = useState(null);
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const [selectedStatsLevel, setSelectedStatsLevel] = useState(null);
  const [linearTrendOpen, setLinearTrendOpen] = useState(false);
  const [linearTrendLevel, setLinearTrendLevel] = useState(null);
  const [histogramViewerOpen, setHistogramViewerOpen] = useState(false);
  const [climatologyViewerOpen, setClimatologyViewerOpen] = useState(false);
  const [seasonalTimeseriesOpen, setSeasonalTimeseriesOpen] = useState(false);
  const { selectedDataset, selectedLevel, metadata } = useGlobeSettings();
  const fetchAbortRef = useRef(null);
  const fetchTokenRef = useRef(0);

  console.log('Metadata received:', JSON.stringify(metadata, null, 2));
  console.log('datasetName:', datasetName);
  console.log('metadata.level_units:', metadata.level_units);

  const datasetUnitFallbacks = {
    "air": "mb",
    "NOAA-CIRES Twentieth Century Reanalysis (V2c)": "mb",
  };

  useEffect(() => {
    if (open && metadata.multilevel && metadata.levels?.length > 0) {
      const hasSelectedLevel = selectedLevel !== null && selectedLevel !== undefined;
      const preferredLevel = hasSelectedLevel ? selectedLevel.toString() : metadata.levels[0].toString();
      const isPreferredValid = metadata.levels.some((level) => level.toString() === preferredLevel);
      const initialLevel = isPreferredValid ? preferredLevel : metadata.levels[0].toString();
      setSelectedLevels([initialLevel]);
      console.log('Initialized selectedLevels for multilevel:', [initialLevel]);
    } else {
      setSelectedLevels(['none']);
      console.log('Initialized selectedLevels for single-level: ["none"]');
    }
  }, [open, metadata.multilevel, metadata.levels, selectedLevel]);

  useEffect(() => {
    if (!open || !selectedDataset || !lat || !lon || !varName) {
      setChartData([]);
      setError(null);
      console.log('Skipping fetch, invalid params:', { open, selectedDataset: !!selectedDataset, lat, lon, varName });
      return;
    }

    if (metadata.metadata_loading || metadata.dataset_path !== selectedDataset.relative_path) {
      console.log('Skipping fetch, metadata not ready for selected dataset yet:', {
        metadataLoading: metadata.metadata_loading,
        metadataPath: metadata.dataset_path,
        selectedPath: selectedDataset.relative_path,
      });
      return;
    }

    if (metadata.multilevel && (!selectedLevels || selectedLevels.length === 0)) {
      console.log('Skipping fetch, no selected levels yet for multilevel dataset');
      return;
    }

    const fetchToken = ++fetchTokenRef.current;
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    const fetchTimeSeries = async () => {
      try {
        const levelUnits = (metadata.level_units || datasetUnitFallbacks[datasetName] || 'level').replace('millibar', 'mb');
        const levelsToFetch = metadata.multilevel && metadata.levels?.length > 0 ? selectedLevels : ['none'];
        console.log('levelsToFetch:', levelsToFetch);
        console.log('selectedLevels:', selectedLevels);
        
        if (levelsToFetch.length === 0) {
          console.log('No levels to fetch');
          setChartData([]);
          return;
        }
        
        const allData = {};
        const colors = {};
        const baseColors = [
          '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
          '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
        ];

        let levelResults = [];

        if (metadata.multilevel && levelsToFetch.length > 0 && levelsToFetch[0] !== 'none') {
          const levelsParam = encodeURIComponent(levelsToFetch.join(','));
          const response = await fetch(
            `/plot_timeseries?path=${encodeURIComponent(selectedDataset.relative_path)}&lat=${lat}&lon=${lon}&variable=${varName}&all_levels=true&levels=${levelsParam}`,
            { signal: controller.signal }
          );
          if (!response.ok) {
            throw new Error(`Failed to fetch multilevel time series: ${response.status} ${response.statusText}`);
          }

          const payload = await response.json();
          const returnedLevels = Array.isArray(payload?.levels) ? payload.levels : [];
          const seriesMap = payload?.series || {};
          const seriesEntries = Object.entries(seriesMap);

          const getSeriesForLevel = (resolvedLevel) => {
            const exact = seriesMap[String(resolvedLevel)];
            if (exact) return exact;

            const levelNum = Number(resolvedLevel);
            if (!Number.isFinite(levelNum)) return null;

            for (const [key, value] of seriesEntries) {
              const keyNum = Number(key);
              if (Number.isFinite(keyNum) && Math.abs(keyNum - levelNum) < 1e-6) {
                return value;
              }
            }
            return null;
          };

          levelResults = returnedLevels.map((resolvedLevel, idx) => ({
            level: resolvedLevel,
            index: idx,
            data: getSeriesForLevel(resolvedLevel) || { times: [], values: [] }
          }));
        } else {
          levelResults = await Promise.all(
            levelsToFetch.map(async (level, i) => {
              console.log(`Fetching time series for level: ${level === 'none' ? 'single-level' : level + ' ' + levelUnits}`);
              const levelParam = level !== 'none' ? `&level=${level}` : '';
              const response = await fetch(
                `/plot_timeseries?path=${encodeURIComponent(selectedDataset.relative_path)}&lat=${lat}&lon=${lon}&variable=${varName}${levelParam}`,
                { signal: controller.signal }
              );
              if (!response.ok) throw new Error(`Failed to fetch time series for ${level === 'none' ? 'single-level' : 'level ' + level}: ${response.status} ${response.statusText}`);
              const data = await response.json();
              return { level, index: i, data };
            })
          );
        }

        if (fetchToken !== fetchTokenRef.current) {
          console.log('Ignoring stale timeseries response');
          return;
        }

        for (const result of levelResults) {
          const { level, index, data } = result;
          console.log('Fetched data from backend:', JSON.stringify(data, null, 2));
          
          // Handle new dict format from backend (times, values, title, xLabel, yLabel, varName, units)
          const xValues = data.times ? (Array.isArray(data.times) ? data.times : Array.from(data.times)) : [];
          const yValues = data.values ? (Array.isArray(data.values) ? data.values : Array.from(data.values)) : [];
          
          console.log('xValues length:', xValues.length);
          console.log('yValues length:', yValues.length);
          console.log('First 5 xValues:', xValues.slice(0, 5));
          console.log('First 5 yValues:', yValues.slice(0, 5));
          
          if (xValues.length === 0 || yValues.length === 0) {
            console.error('Empty data arrays!');
            throw new Error(`Invalid timeseries data for ${level === 'none' ? 'single-level' : 'level ' + level}`);
          }
          
          const levelKey = level === 'none' ? 'Single Level' : `${level} ${levelUnits}`;
          colors[levelKey] = baseColors[index % baseColors.length];
          console.log('Processing levelKey:', levelKey, 'with', xValues.length, 'data points');
          // Map backend timeseries arrays into Recharts-friendly rows
          for (let j = 0; j < xValues.length; j++) {
            const date = xValues[j];
            if (!allData[date]) {
              allData[date] = { date };
            }
            allData[date][levelKey] = yValues[j];
          }
        }

        // Convert object to sorted array for Recharts
        const chartArray = Object.values(allData).sort((a, b) => new Date(a.date) - new Date(b.date));
        console.log('Final chartArray:', chartArray.slice(0, 3));
        console.log('chartArray keys:', chartArray.length > 0 ? Object.keys(chartArray[0]) : 'no data');
        setChartData(chartArray);
        console.log('Set chartData with', chartArray.length, 'points');
        setError(null);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Error fetching time series:', err);
        setError(`Failed to load time series data: ${err.message}`);
        setChartData([]);
      }
    };

    fetchTimeSeries();
    return () => {
      controller.abort();
    };
  }, [open, lat, lon, varName, selectedDataset, selectedLevels, metadata.multilevel, metadata.levels, metadata.level_units, metadata.metadata_loading, metadata.dataset_path, datasetName]);


  const handleLevelChange = useCallback((event) => {
    const level = event.target.name;
    setSelectedLevels((prev) => {
      const newLevels = event.target.checked
        ? [...prev, level]
        : prev.filter((l) => l !== level);
      console.log('Updated selectedLevels:', newLevels);
      return newLevels;
    });
  }, []);

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => {
    setAnchorEl(null);
    setComputingAnchorEl(null);
    setSeasonalAnchorEl(null);
  };

  const handleComputingMenuOpen = (event) => setComputingAnchorEl(event.currentTarget);
  const handleComputingMenuClose = () => setComputingAnchorEl(null);

  const handleSeasonalMenuOpen = (event) => setSeasonalAnchorEl(event.currentTarget);
  const handleSeasonalMenuClose = () => setSeasonalAnchorEl(null);

  const handleMenuAction = useCallback((action, level) => {
    handleMenuClose();
    console.log(`Selected action: ${action} for level: ${level || 'none'}`);
    if (action === 'Plot Histogram') {
      setHistogramViewerOpen(true);
    } else if (action === 'Statistics Summary') {
      setSelectedStatsLevel(level);
      setStatisticsOpen(true);
    } else if (action === 'Plot Linear Trend') {
      setLinearTrendLevel(level);
      setLinearTrendOpen(true);
    } else if (action === 'Climatology Graph') {
      setClimatologyViewerOpen(true);
    } else if (action === 'Seasonal Timeseries') {
      setSeasonalTimeseriesOpen(true);
    } else if (action === 'Mean and Standard Deviation') {
      alert(`Action triggered: ${action}`);
    } else {
      alert(`Action triggered: ${action}`);
    }
  }, []);

  const handleStatisticsClose = () => {
    setStatisticsOpen(false);
    setSelectedStatsLevel(null);
  };

  const handleLinearTrendClose = () => {
    setLinearTrendOpen(false);
    setLinearTrendLevel(null);
  };

  const handleHistogramViewerClose = () => {
    setHistogramViewerOpen(false);
  };

  const handleClimatologyViewerClose = () => {
    setClimatologyViewerOpen(false);
  };

  const handleSeasonalTimeseriesClose = () => {
    setSeasonalTimeseriesOpen(false);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        sx={{ '& .MuiDialog-paper': { minHeight: '600px' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            aria-label="menu"
            onClick={handleMenuOpen}
            sx={{ marginRight: 2 }}
          >
            <MenuIcon />
          </IconButton>
          Time Series at ({lat.toFixed(2)}°N, {lon.toFixed(2)}°{lon >= 0 ? 'E' : 'W'}) for {datasetName}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => handleMenuAction('Download Data')}>
              Download Data
            </MenuItem>
            <MenuItem
              onClick={handleComputingMenuOpen}
              onMouseEnter={handleComputingMenuOpen}
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              Computing
              <ArrowRightIcon fontSize="small" />
            </MenuItem>
            <Menu
              anchorEl={computingAnchorEl}
              open={Boolean(computingAnchorEl)}
              onClose={handleComputingMenuClose}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              {metadata.multilevel && metadata.levels?.length > 0 ? (
                selectedLevels.map((level) => (
                  <MenuItem
                    key={level}
                    onClick={() => handleMenuAction('Statistics Summary', level)}
                  >
                    Statistics Summary ({level} {(metadata.level_units || datasetUnitFallbacks[datasetName] || 'mb').replace('millibar', 'mb')})
                  </MenuItem>
                ))
              ) : (
                <MenuItem
                  onClick={() => handleMenuAction('Statistics Summary', 'none')}
                >
                  Statistics Summary
                </MenuItem>
              )}
              <MenuItem onClick={() => handleMenuAction('Plot Linear Trend')}>
                Plot Linear Trend
              </MenuItem>
              <MenuItem onClick={() => handleMenuAction('Plot Histogram')}>
                Plot Histogram
              </MenuItem>
            </Menu>
            <MenuItem
              onClick={handleSeasonalMenuOpen}
              onMouseEnter={handleSeasonalMenuOpen}
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              View Seasonal Data
              <ArrowRightIcon fontSize="small" />
            </MenuItem>
            <Menu
              anchorEl={seasonalAnchorEl}
              open={Boolean(seasonalAnchorEl)}
              onClose={handleSeasonalMenuClose}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              <MenuItem onClick={() => handleMenuAction('Mean and Standard Deviation')}>
                Mean and Standard Deviation
              </MenuItem>
              <MenuItem onClick={() => handleMenuAction('Climatology Graph')}>
                Climatology Graph
              </MenuItem>
              <MenuItem onClick={() => handleMenuAction('Seasonal Timeseries')}>
                Seasonal Timeseries
              </MenuItem>
            </Menu>
          </Menu>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}
          {chartData.length > 0 ? (
            <Box sx={{ width: '100%', height: '500px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Date', position: 'insideBottomRight', offset: -5 }}
                  />
                  <YAxis
                    label={{ value: `${varName} (${units})`, angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip formatter={(value) => value?.toFixed(2)} />
                  <Legend />
                  {selectedLevels.map((level, idx) => {
                    const levelKey = level === 'none' ? 'Single Level' : `${level} ${(metadata.level_units || 'mb').replace('millibar', 'mb')}`;
                    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
                    return (
                      <Line
                        key={levelKey}
                        type="monotone"
                        dataKey={levelKey}
                        stroke={colors[idx % colors.length]}
                        dot={false}
                        isAnimationActive={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Typography>Loading time series...</Typography>
          )}
          {metadata.multilevel && metadata.levels?.length > 0 && (
            <FormControl component="fieldset" sx={{ mt: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Select Pressure Levels ({(metadata.level_units || datasetUnitFallbacks[datasetName] || 'level').replace('millibar', 'mb')}):
              </Typography>
              <FormGroup row>
                {metadata.levels.map((level) => (
                  <FormControlLabel
                    key={level}
                    control={
                      <Checkbox
                        checked={selectedLevels.includes(level.toString())}
                        onChange={handleLevelChange}
                        name={level.toString()}
                      />
                    }
                    label={`${level} ${(metadata.level_units || datasetUnitFallbacks[datasetName] || 'level').replace('millibar', 'mb')}`}
                  />
                ))}
              </FormGroup>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
      <HistogramViewer
        open={histogramViewerOpen}
        onClose={handleHistogramViewerClose}
        lat={lat}
        lon={lon}
        varName={varName}
        units={units}
        datasetPath={selectedDataset?.relative_path}
        datasetName={datasetName}
        level={selectedLevels.length > 0 ? selectedLevels[0] : null}
        multilevel={metadata.multilevel}
        levels={metadata.levels}
      />
      <StatisticsDialog
        open={statisticsOpen}
        onClose={handleStatisticsClose}
        lat={lat}
        lon={lon}
        varName={varName}
        units={units}
        datasetName={datasetName}
        level={selectedStatsLevel || (selectedLevels.length > 0 ? selectedLevels[0] : 'none')}
        metadata={metadata}
      />
      <LinearTrend
        open={linearTrendOpen}
        onClose={handleLinearTrendClose}
        lat={lat}
        lon={lon}
        varName={varName}
        units={units}
        datasetPath={selectedDataset?.relative_path}
        datasetName={datasetName}
        level={linearTrendLevel || (selectedLevels.length > 0 ? selectedLevels[0] : null)}
        multilevel={metadata.multilevel}
        levels={metadata.levels}
      />
      <ClimatologyViewer
        open={climatologyViewerOpen}
        onClose={handleClimatologyViewerClose}
        lat={lat}
        lon={lon}
        varName={varName}
        units={units}
        datasetPath={selectedDataset?.relative_path}
        datasetName={datasetName}
        level={selectedLevels.length > 0 ? selectedLevels[0] : null}
        multilevel={metadata.multilevel}
        levels={metadata.levels}
      />
      <SeasonalTimeseries
        open={seasonalTimeseriesOpen}
        onClose={handleSeasonalTimeseriesClose}
        lat={lat}
        lon={lon}
        varName={varName}
        units={units}
        datasetPath={selectedDataset?.relative_path}
        datasetName={datasetName}
        level={selectedLevels.length > 0 ? selectedLevels[0] : null}
        multilevel={metadata.multilevel}
        levels={metadata.levels}
      />
    </>
  );
}

export default TimeSeries;