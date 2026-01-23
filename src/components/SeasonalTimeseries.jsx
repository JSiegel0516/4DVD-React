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
];

const SeasonalTimeseries = ({
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
  const [data, setData] = useState([]);
  const [dateRange, setDateRange] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  // Get month label for title
  const getMonthLabel = (monthValue) => {
    const month = MONTHS.find(m => m.value === monthValue);
    return month ? month.label : 'Month';
  };

  // Filter timeseries data by selected month
  const filterByMonth = useCallback((timeseries, month) => {
    const monthCode = month; // e.g., "01" for January
    
    const filtered = timeseries.filter(point => {
      // Extract month from timestamp (e.g., "2020-01-15" -> "01")
      const datePart = point.name.split('T')[0];
      const parts = datePart.split('-');
      
      if (parts.length >= 2) {
        const pointMonth = parts[1]; // Extract month as string "01", "02", etc.
        return pointMonth === monthCode;
      }
      return false;
    });

    // Transform to year-based data (extract year for x-axis)
    const yearData = filtered.map(point => {
      const datePart = point.name.split('T')[0];
      const year = datePart.split('-')[0]; // Extract year
      
      return {
        year: parseInt(year),
        value: point.value,
      };
    });

    // Sort by year
    yearData.sort((a, b) => a.year - b.year);

    console.log('Filtered data for month', month, ':', yearData.length, 'points');
    return yearData;
  }, []);

  // Fetch and process seasonal timeseries data
  const fetchSeasonalData = useCallback(async () => {
    if (!datasetPath) return;

    setLoading(true);
    setError(null);

    try {
      const levelParam = multilevel && selectedLevel ? `&level=${selectedLevel}` : '';

      // Fetch full timeseries data
      const response = await fetch(
        `http://localhost:8080/plot_timeseries?path=${encodeURIComponent(datasetPath)}&lat=${lat}&lon=${lon}&variable=${varName}${levelParam}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch seasonal timeseries: ${response.status}`);
      }

      const result = await response.json();
      const timeseries = result.times.map((time, idx) => ({
        name: time,
        value: result.values[idx],
      }));

      console.log('Full timeseries length:', timeseries.length);

      // Filter by selected month
      const monthlyData = filterByMonth(timeseries, selectedMonth);

      if (monthlyData.length === 0) {
        setError('No data available for the selected month.');
        setData([]);
        setDateRange('');
        return;
      }

      // Calculate date range
      const years = monthlyData.map(d => d.year);
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      setDateRange(`${getMonthLabel(selectedMonth)} ${minYear} - ${getMonthLabel(selectedMonth)} ${maxYear}`);

      setData(monthlyData);
      setError(null);
    } catch (err) {
      console.error('Error fetching seasonal timeseries:', err);
      setError(err.message);
      setData([]);
      setDateRange('');
    } finally {
      setLoading(false);
    }
  }, [datasetPath, lat, lon, varName, multilevel, selectedLevel, selectedMonth, filterByMonth]);

  // Fetch data when parameters change
  useEffect(() => {
    if (open) {
      fetchSeasonalData();
    }
  }, [open, selectedMonth, selectedLevel, fetchSeasonalData]);

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
    alert(`Action triggered: ${action}`);
  };

  const levelDisplay = multilevel && selectedLevel ? `${selectedLevel} mb` : 'Single Level';
  const monthLabel = getMonthLabel(selectedMonth);
  const title = `${monthLabel} Seasonal Time Series - ${varName} (${levelDisplay})`;

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
            <MenuItem onClick={() => handleMenuAction('Climatology Graph')}>
              Climatology Graph
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

          <Box sx={{ fontSize: '0.85rem', color: '#666' }}>
            <Typography variant="caption">
              <strong>Location:</strong>
              <br />
              Lat: {lat.toFixed(2)}°N
              <br />
              Lon: {lon.toFixed(2)}°{lon >= 0 ? 'E' : 'W'}
            </Typography>
          </Box>

          {dateRange && (
            <>
              <Divider />
              <Typography variant="caption" sx={{ color: '#666' }}>
                <strong>Date Range:</strong>
                <br />
                {dateRange}
              </Typography>
            </>
          )}
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
                  dataKey="year"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  label={{ value: 'Year', position: 'insideBottomRight', offset: -10 }}
                  tickFormatter={(value) => value.toString()}
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
                  labelFormatter={(label) => `Year: ${label}`}
                />
                <Legend />

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#1f77b4"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name={`${monthLabel} ${varName}`}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {!loading && data.length === 0 && !error && (
            <Alert severity="info">No data available for the selected month.</Alert>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default SeasonalTimeseries;
