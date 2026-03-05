import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material';
import Plot from 'react-plotly.js';
import { useGlobeSettings } from './GlobeSettingsContext';

function HistogramDialog({ open, onClose, varName, units, datasetName }) {
  const [plotData, setPlotData] = useState([]);
  const [layout, setLayout] = useState(null);
  const [error, setError] = useState(null);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [level, setLevel] = useState('');
  const [isLoadingDates, setIsLoadingDates] = useState(false);
  const { selectedDataset, metadata, availableDates } = useGlobeSettings();

  // Dataset-specific unit fallbacks
  const datasetUnitFallbacks = {
    "air": "mb",
    "NOAA-CIRES Twentieth Century Reanalysis (V2c)": "mb",
  };

  // Log selected dataset path for debugging
  useEffect(() => {
    if (selectedDataset) {
      console.log("Selected dataset relative path:", selectedDataset.relative_path);
    }
  }, [selectedDataset]);

  // Extract years from availableDates
  const years = [...new Set(availableDates.map(date => date.split('-')[0]))].sort();

  // Initialize year and month based on availableDates
  useEffect(() => {
    if (!open || !selectedDataset || !availableDates.length) {
      setYear('');
      setMonth('');
      setError(null);
      setIsLoadingDates(false);
      return;
    }

    setIsLoadingDates(true);
    try {
      if (years.length > 0) {
        setYear(years[0]); // Default to first available year
        setMonth('1'); // Default to January
        console.log("Initialized year:", years[0], "month: 1");
      } else {
        setError("No valid years found in dataset");
      }
    } catch (err) {
      console.error('Error initializing dates:', err);
      setError(`Failed to initialize dates: ${err.message}`);
    } finally {
      setIsLoadingDates(false);
    }
  }, [open, selectedDataset, availableDates]);

  // Set default level for multilevel datasets
  useEffect(() => {
    if (open && metadata.multilevel && metadata.levels?.length > 0) {
      setLevel(metadata.levels[0].toString());
    } else {
      setLevel('none');
    }
  }, [open, metadata.multilevel, metadata.levels]);

  // Fetch histogram data only when dates are loaded
  useEffect(() => {
    if (!open || !selectedDataset || !year || !month || !varName || isLoadingDates) {
      setPlotData([]);
      setLayout(null);
      setError(null);
      return;
    }

    const fetchHistogram = async () => {
      try {
        const levelParam = level !== 'none' ? `&level=${level}` : '';
        const normalizedPath = selectedDataset.relative_path.replace(/\\/g, '/');
        console.log("Fetching histogram for path:", normalizedPath);
        const response = await fetch(
          `/month_histogram?path=${encodeURIComponent(normalizedPath)}&variable=${varName}&year=${year}&month=${month}&bins=30${levelParam}`
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch histogram: ${response.statusText} - ${errorText}`);
        }
        const data = await response.json();
        console.log('Received Plotly data:', JSON.stringify(data, null, 2));
        const trace = data.data[0];
        if (!trace || !trace.x || !trace.y) {
          throw new Error('Invalid Plotly data for histogram: missing x or y data');
        }
        setPlotData([{
          ...trace,
          name: `${varName} (${year}-${month.padStart(2, '0')}${level !== 'none' ? `, ${level} ${(metadata.level_units || datasetUnitFallbacks[datasetName] || 'level').replace('millibar', 'mb')}` : ''})`,
          type: 'histogram',
          marker: { color: '#1f77b4' },
        }]);
        setLayout({
          title: {
            text: `Histogram of ${varName} for ${year}-${month.padStart(2, '0')}${level !== 'none' ? `, ${level} ${(metadata.level_units || datasetUnitFallbacks[datasetName] || 'level').replace('millibar', 'mb')}` : ''}`,
            font: { size: 18, weight: 'bold' },
          },
          xaxis: {
            title: { text: `${varName} (${units})`, font: { size: 14, weight: 'bold' } },
          },
          yaxis: {
            title: { text: 'Frequency', font: { size: 14, weight: 'bold' } },
          },
          width: 1000,
          height: 500,
          margin: { t: 80, b: 80, l: 80, r: 80 },
          showlegend: true,
          legend: {
            x: 1,
            xanchor: 'right',
            y: 1,
            yanchor: 'top',
            font: { size: 12, weight: 'bold' },
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: '#000',
            borderwidth: 1,
          },
        });
        setError(null);
      } catch (err) {
        console.error('Error fetching histogram:', err);
        setError(`Failed to load histogram: ${err.message}`);
        setPlotData([]);
        setLayout(null);
      }
    };

    fetchHistogram();
  }, [open, selectedDataset, year, month, level, varName, units, metadata.level_units, metadata.multilevel, metadata.levels, datasetName, isLoadingDates]);

  const handleYearChange = (event) => {
    setYear(event.target.value);
    setMonth('1'); // Reset to January when year changes
  };

  const handleMonthChange = (event) => {
    setMonth(event.target.value);
  };

  const handleLevelChange = (event) => {
    setLevel(event.target.value);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{ '& .MuiDialog-paper': { minHeight: '600px' } }}
    >
      <DialogTitle>
        Histogram for {datasetName} ({varName})
      </DialogTitle>
      <DialogContent>
        {isLoadingDates ? (
          <Typography>Loading available dates...</Typography>
        ) : (
          <>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Year</InputLabel>
              <Select value={year} onChange={handleYearChange} label="Year" disabled={years.length === 0}>
                {years.map((y) => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Month</InputLabel>
              <Select value={month} onChange={handleMonthChange} label="Month" disabled={years.length === 0}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <MenuItem key={m} value={m.toString()}>
                    {new Date(0, m - 1).toLocaleString('en-US', { month: 'long' })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {metadata.multilevel && metadata.levels?.length > 0 && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Pressure Level</InputLabel>
                <Select value={level} onChange={handleLevelChange} label="Pressure Level">
                  {metadata.levels.map((l) => (
                    <MenuItem key={l} value={l.toString()}>
                      {l} {(metadata.level_units || datasetUnitFallbacks[datasetName] || 'level').replace('millibar', 'mb')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {error && (
              <Typography color="error" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}
            {plotData.length > 0 && layout ? (
              <Plot
                data={plotData}
                layout={layout}
                style={{ width: '100%', height: '500px' }}
                config={{ responsive: true }}
              />
            ) : (
              <Typography>Loading histogram...</Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default HistogramDialog;