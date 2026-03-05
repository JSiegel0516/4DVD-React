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
  IconButton,
  Menu,
  Divider,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const ClimatologyViewer = ({
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
  const [selectedLevel, setSelectedLevel] = useState(level || '');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const MONTH_CODES = [
    '-01', '-02', '-03', '-04', '-05', '-06',
    '-07', '-08', '-09', '-10', '-11', '-12',
  ];

  // Calculate monthly climatology (min, avg, max)
  const calculateClimatology = useCallback((timeseries) => {
    const monthlyData = {};

    // Initialize months (0-11)
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = [];
    }

    // Group values by month
    timeseries.forEach(point => {
      // Extract month from timestamp (works with formats like "2020-01-15" or "2020-01-15T00:00:00")
      // Get the month part (1-12) and convert to 0-indexed (0-11)
      const datePart = point.name.split('T')[0]; // Get just the date part if there's a time component
      const parts = datePart.split('-');
      
      if (parts.length >= 2) {
        const monthNum = parseInt(parts[1], 10); // Extract month as number (1-12)
        if (monthNum >= 1 && monthNum <= 12 && isFinite(point.value)) {
          monthlyData[monthNum - 1].push(point.value); // Convert to 0-indexed
        }
      }
    });

    console.log('Monthly data grouping:', monthlyData);

    // Calculate statistics for each month
    const climatologyData = [];
    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const values = monthlyData[monthIdx];
      
      if (values.length > 0) {
        const sortedValues = [...values].sort((a, b) => a - b);
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const min = sortedValues[0];
        const max = sortedValues[sortedValues.length - 1];

        climatologyData.push({
          month: MONTHS[monthIdx],
          monthNum: monthIdx + 1,
          'Historical High': parseFloat(max.toFixed(3)),
          'Climatology': parseFloat(avg.toFixed(3)),
          'Historical Low': parseFloat(min.toFixed(3)),
        });
      }
    }

    console.log('Calculated climatology data:', climatologyData);
    return climatologyData;
  }, []);

  // Fetch and process climatology data
  const fetchClimatologyData = useCallback(async () => {
    if (!datasetPath) return;

    setLoading(true);
    setError(null);

    try {
      const levelParam = multilevel && selectedLevel ? `&level=${selectedLevel}` : '';

      // Fetch full timeseries data
      const response = await fetch(
        `/plot_timeseries?path=${encodeURIComponent(datasetPath)}&lat=${lat}&lon=${lon}&variable=${varName}${levelParam}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch climatology data: ${response.status}`);
      }

      const result = await response.json();
      console.log('Fetched timeseries result:', result);
      console.log('First 5 times:', result.times?.slice(0, 5));
      console.log('First 5 values:', result.values?.slice(0, 5));
      
      const timeseries = result.times.map((time, idx) => ({
        name: time,
        value: result.values[idx],
      }));

      console.log('Mapped timeseries (first 5):', timeseries.slice(0, 5));

      // Calculate climatology statistics
      const climatologyData = calculateClimatology(timeseries);

      if (climatologyData.length === 0) {
        console.error('No climatology data generated');
        setError('No data available for climatology calculation.');
        setData([]);
        return;
      }

      setData(climatologyData);
      setError(null);
    } catch (err) {
      console.error('Error fetching climatology data:', err);
      setError(err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [datasetPath, lat, lon, varName, multilevel, selectedLevel, calculateClimatology]);

  // Fetch data when parameters change
  useEffect(() => {
    if (open) {
      fetchClimatologyData();
    }
  }, [open, selectedLevel, fetchClimatologyData]);

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
    // Can be extended for Mean and Std Dev, Seasonal Timeseries, etc.
    alert(`Action triggered: ${action}`);
  };

  const levelDisplay = multilevel && selectedLevel ? `${selectedLevel} mb` : 'Single Level';
  const title = `Monthly Climatology - ${varName} (${levelDisplay})`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <IconButton onClick={handleMenuOpen} size="small">
            <MenuIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <MenuItem onClick={() => handleMenuAction('Save Graph')}>Save Graph</MenuItem>
            <MenuItem onClick={() => handleMenuAction('Mean and Standard Deviation')}>
              Mean and Standard Deviation
            </MenuItem>
            <MenuItem onClick={() => handleMenuAction('Seasonal Time Series')}>
              Seasonal Time Series
            </MenuItem>
          </Menu>
          <Typography variant="h6">{title}</Typography>
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

          <Box sx={{ fontSize: '0.85rem', color: '#666' }}>
            <Typography variant="caption">
              <strong>Location:</strong>
              <br />
              Lat: {lat.toFixed(2)}°N
              <br />
              Lon: {lon.toFixed(2)}°{lon >= 0 ? 'E' : 'W'}
            </Typography>
          </Box>

          <Typography variant="caption" sx={{ mt: 2, color: '#999' }}>
            <strong>Legend:</strong>
            <br />
            <span style={{ color: '#1f77b4' }}>━</span> Climatology (Average)
            <br />
            <span style={{ color: '#ff7300' }}>━</span> Historical High
            <br />
            <span style={{ color: '#2ca02c' }}>━</span> Historical Low
          </Typography>
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
              <LineChart
                data={data}
                margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  label={{
                    value: `${varName} (${units})`,
                    angle: -90,
                    position: 'insideLeft',
                  }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#f9f9f9', border: '1px solid #ccc' }}
                  formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : value)}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Legend />

                {/* Climatology (Average) - Main line */}
                <Line
                  type="monotone"
                  dataKey="Climatology"
                  stroke="#1f77b4"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Climatology"
                />

                {/* Historical High */}
                <Line
                  type="monotone"
                  dataKey="Historical High"
                  stroke="#ff7300"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Historical High"
                />

                {/* Historical Low */}
                <Line
                  type="monotone"
                  dataKey="Historical Low"
                  stroke="#2ca02c"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Historical Low"
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {!loading && data.length === 0 && !error && (
            <Alert severity="info">No data available for climatology calculation.</Alert>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ClimatologyViewer;
