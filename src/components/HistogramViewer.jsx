import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  Alert,
  Slider,
  Button,
  IconButton,
  Menu,
  Divider,
  List,
  ListItem,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
  { value: '13', label: 'Dec, Jan, Feb (DJF)' },
  { value: '14', label: 'Mar, Apr, May (MAM)' },
  { value: '15', label: 'Jun, Jul, Aug (JJA)' },
  { value: '16', label: 'Sep, Oct, Nov (SON)' },
];

const HistogramViewer = ({
  open,
  onClose,
  lat,
  lon,
  varName,
  units,
  datasetPath,
  datasetName,
  level,
  multilevel,
  levels,
}) => {
  const [selectedMonth, setSelectedMonth] = useState('01');
  const [selectedLevel, setSelectedLevel] = useState(level || '');
  const [bins, setBins] = useState(30);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  // Get month label for title
  const getMonthLabel = (monthValue) => {
    const month = MONTHS.find(m => m.value === monthValue);
    return month ? month.label : 'Month';
  };

  // Filter data by month or seasonal range
  const filterDataByMonth = useCallback((rawTimeseries, month) => {
    const monthInt = parseInt(month);

    if (monthInt >= 13) {
      // Seasonal data
      let monthsToInclude = [];
      switch (monthInt) {
        case 13: // DJF
          monthsToInclude = ['12', '01', '02'];
          break;
        case 14: // MAM
          monthsToInclude = ['03', '04', '05'];
          break;
        case 15: // JJA
          monthsToInclude = ['06', '07', '08'];
          break;
        case 16: // SON
          monthsToInclude = ['09', '10', '11'];
          break;
        default:
          break;
      }
      return rawTimeseries.filter(point => {
        const pointMonth = point.name.substr(5, 2);
        return monthsToInclude.includes(pointMonth);
      });
    } else {
      // Single month
      return rawTimeseries.filter(point => {
        const pointMonth = point.name.substr(5, 2);
        return pointMonth === month;
      });
    }
  }, []);

  // Build histogram from data values
  const buildHistogram = useCallback((values, numBins) => {
    if (values.length === 0) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / numBins;

    // Initialize bins
    const histogram = Array.from({ length: numBins }, (_, i) => ({
      range: `${(min + i * binWidth).toFixed(2)}-${(min + (i + 1) * binWidth).toFixed(2)}`,
      count: 0,
      min: min + i * binWidth,
      max: min + (i + 1) * binWidth,
    }));

    // Count values in each bin
    values.forEach(value => {
      let binIndex = Math.floor((value - min) / binWidth);
      // Handle edge case where value equals max
      if (binIndex === numBins) {
        binIndex = numBins - 1;
      }
      if (binIndex >= 0 && binIndex < numBins) {
        histogram[binIndex].count += 1;
      }
    });

    return histogram;
  }, []);

  // Fetch and process histogram data
  const fetchHistogramData = useCallback(async () => {
    if (!datasetPath) return;

    setLoading(true);
    setError(null);

    try {
      const levelParam = multilevel && selectedLevel ? `&level=${selectedLevel}` : '';

      // Fetch full timeseries data
      const response = await fetch(
        `/api/plot_timeseries?path=${encodeURIComponent(datasetPath)}&lat=${lat}&lon=${lon}&variable=${varName}${levelParam}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch histogram data: ${response.status}`);
      }

      const result = await response.json();
      const rawTimeseries = result.times.map((time, idx) => ({
        name: time,
        value: result.values[idx],
      }));

      // Filter by month
      const filteredData = filterDataByMonth(rawTimeseries, selectedMonth);

      if (filteredData.length === 0) {
        setData([]);
        setError('No data available for the selected month and level.');
        return;
      }

      // Extract values and build histogram
      const values = filteredData.map(d => d.value).filter(v => isFinite(v));
      const histogram = buildHistogram(values, bins);

      setData(histogram);
      setError(null);
    } catch (err) {
      console.error('Error fetching histogram data:', err);
      setError(err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [datasetPath, lat, lon, varName, multilevel, selectedLevel, selectedMonth, bins, filterDataByMonth, buildHistogram]);

  // Fetch data when parameters change
  useEffect(() => {
    if (open) {
      fetchHistogramData();
    }
  }, [open, selectedMonth, selectedLevel, bins, fetchHistogramData]);

  // Set initial level if multilevel
  useEffect(() => {
    if (multilevel && levels && levels.length > 0 && !selectedLevel) {
      setSelectedLevel(levels[0]);
    }
  }, [multilevel, levels]);

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleMenuAction = (action) => {
    handleMenuClose();
    console.log(`Action triggered: ${action}`);
    // Can be extended for Statistical Summary, Linear Trend, etc.
    alert(`Action triggered: ${action}`);
  };

  const levelDisplay = multilevel && selectedLevel ? `${selectedLevel} mb` : 'Single Level';
  const monthLabel = getMonthLabel(selectedMonth);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <IconButton onClick={handleMenuOpen} size="small">
            <MenuIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <MenuItem onClick={() => handleMenuAction('Save Graph')}>Save Graph</MenuItem>
            <MenuItem onClick={() => handleMenuAction('Statistical Summary')}>
              Statistical Summary
            </MenuItem>
            <MenuItem onClick={() => handleMenuAction('Linear Trend')}>Linear Trend</MenuItem>
          </Menu>
          <Typography variant="h6">
            {monthLabel} Histogram - {varName} ({levelDisplay})
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', gap: 3, p: 3 }}>
        {/* Sidebar */}
        <Box
          sx={{
            width: 250,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            borderRight: '1px solid #e0e0e0',
            pr: 2,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            Controls
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel>Month</InputLabel>
            <Select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} label="Month">
              {MONTHS.map(month => (
                <MenuItem key={month.value} value={month.value}>
                  {month.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {multilevel && levels && levels.length > 0 && (
            <FormControl fullWidth size="small">
              <InputLabel>Level</InputLabel>
              <Select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                label="Level"
              >
                {levels.map(lvl => (
                  <MenuItem key={lvl} value={lvl}>
                    {lvl} mb
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Divider />

          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            Number of Bins: {bins}
          </Typography>

          <Slider
            value={bins}
            onChange={(e, newValue) => setBins(newValue)}
            min={10}
            max={150}
            step={5}
            marks={[
              { value: 10, label: '10' },
              { value: 75, label: '75' },
              { value: 150, label: '150' },
            ]}
            valueLabelDisplay="auto"
          />

          <Divider />

          <Box sx={{ fontSize: '0.85rem', color: '#666' }}>
            <Typography variant="caption">
              <strong>Location:</strong>
              <br />
              Lat: {lat.toFixed(2)}°N
              <br />
              Lon: {lon.toFixed(2)}°{lon >= 0 ? 'E' : 'W'}
            </Typography>
          </Box>
        </Box>

        {/* Main Content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
              {error}
            </Alert>
          )}

          {!loading && data.length > 0 && (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={data}
                margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="range"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={Math.max(0, Math.floor(data.length / 10))}
                />
                <YAxis label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#f9f9f9', border: '1px solid #ccc' }}
                  formatter={(value) => (typeof value === 'number' ? value : value)}
                />
                <Legend />
                <Bar dataKey="count" fill="#1f77b4" name="Frequency" />
              </BarChart>
            </ResponsiveContainer>
          )}

          {!loading && data.length === 0 && !error && (
            <Alert severity="info">No data available for the selected parameters.</Alert>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default HistogramViewer;
