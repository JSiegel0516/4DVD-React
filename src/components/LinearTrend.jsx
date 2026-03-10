import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ComposedChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
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
  { value: '13', label: 'Annual' },
];

const LinearTrend = ({ 
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
  levels 
}) => {
  const [selectedMonth, setSelectedMonth] = useState('01');
  const [selectedLevel, setSelectedLevel] = useState(level || '');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trendStats, setTrendStats] = useState(null);

  // Linear least squares regression
  const leastSquares = useCallback((input_x, input_y) => {
    const reduceSumFunc = (prev, cur) => prev + cur;
    
    const x_bar = (input_x.reduce(reduceSumFunc) * 1.0) / input_x.length;
    const y_bar = (input_y.reduce(reduceSumFunc) * 1.0) / input_y.length;

    const SSxx = input_x
      .map(o => Math.pow(o - x_bar, 2))
      .reduce(reduceSumFunc);
    const SSyy = input_y
      .map(d => Math.pow(d - y_bar, 2))
      .reduce(reduceSumFunc);
    const SSxy = input_x
      .map((d, i) => (d - x_bar) * (input_y[i] - y_bar))
      .reduce(reduceSumFunc);

    const slope = SSxy / SSxx;
    const intercept = y_bar - x_bar * slope;
    const rSquare = Math.pow(SSxy, 2) / (SSxx * SSyy);

    return { slope, intercept, rSquare };
  }, []);

  // Process annual data (average by year)
  const processAnnualData = useCallback((rawData) => {
    const groupedByYear = {};
    
    rawData.forEach(point => {
      const year = point.name.substr(0, 4);
      if (!groupedByYear[year]) {
        groupedByYear[year] = [];
      }
      groupedByYear[year].push(point.value);
    });

    return Object.entries(groupedByYear).map(([year, values]) => ({
      name: year,
      value: values.reduce((a, b) => a + b, 0) / values.length,
    }));
  }, []);

  // Filter data by month
  const filterByMonth = useCallback((rawData, month) => {
    return rawData.filter(point => {
      const pointMonth = point.name.substr(5, 2);
      return pointMonth === month;
    });
  }, []);

  // Fetch and process trend data
  const fetchTrendData = useCallback(async () => {
    if (!datasetPath) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Build level parameter if multilevel
      const levelParam = multilevel && selectedLevel ? `&level=${selectedLevel}` : '';
      
      // Fetch full timeseries data
      const response = await fetch(
        `/api/plot_timeseries?path=${encodeURIComponent(datasetPath)}&lat=${lat}&lon=${lon}&variable=${varName}${levelParam}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch trend data: ${response.status}`);
      }

      const result = await response.json();
      let processedData;

      // Convert times and values into array of objects
      const rawTimeseries = result.times.map((time, idx) => ({
        name: time,
        value: result.values[idx],
      }));

      if (selectedMonth === '13') {
        // Annual data
        processedData = processAnnualData(rawTimeseries);
      } else {
        // Monthly data
        processedData = filterByMonth(rawTimeseries, selectedMonth);
      }

      // Calculate trend line
      const input_x = Array.from({ length: processedData.length }, (_, i) => i + 1);
      const input_y = processedData.map(d => d.value);

      const stats = leastSquares(input_x, input_y);

      // Add trend line points to data
      const dataWithTrend = processedData.map((point, idx) => ({
        ...point,
        trendValue: stats.slope * (idx + 1) + stats.intercept,
      }));

      setData(dataWithTrend);
      setTrendStats(stats);
    } catch (err) {
      console.error('Error fetching trend data:', err);
      setError(err.message);
      setData([]);
      setTrendStats(null);
    } finally {
      setLoading(false);
    }
  }, [datasetPath, lat, lon, varName, multilevel, selectedLevel, selectedMonth, processAnnualData, filterByMonth, leastSquares]);

  // Fetch data when month/level changes
  useEffect(() => {
    if (open) {
      fetchTrendData();
    }
  }, [open, selectedMonth, selectedLevel, fetchTrendData]);

  // Set initial level if multilevel
  useEffect(() => {
    if (multilevel && levels && levels.length > 0 && !selectedLevel) {
      setSelectedLevel(levels[0]);
    }
  }, [multilevel, levels]);

  const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || 'Month';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Linear Trend Analysis</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3, display: 'flex', gap: 2, mt: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Month</InputLabel>
            <Select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              label="Month"
            >
              {MONTHS.map(month => (
                <MenuItem key={month.value} value={month.value}>
                  {month.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {multilevel && levels && levels.length > 0 && (
            <FormControl sx={{ minWidth: 200 }}>
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
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && data.length > 0 && trendStats && (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Equation:</strong> y = {trendStats.slope.toFixed(5)} × t + {trendStats.intercept.toFixed(3)}
              </Typography>
              <Typography variant="body2">
                <strong>R²:</strong> {trendStats.rSquare.toFixed(3)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, overflowX: 'auto' }}>
              <ComposedChart width={800} height={500} data={data} margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  label={{ value: 'Year/Time', position: 'insideBottomRight', offset: -10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  label={{ value: `${varName} (${units})`, angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#f9f9f9', border: '1px solid #ccc' }}
                  formatter={(value) => {
                    if (typeof value === 'number') {
                      return value.toFixed(2);
                    }
                    return value;
                  }}
                />
                <Legend />
                
                {/* Scatter points for actual data */}
                <Scatter
                  name={varName}
                  dataKey="value"
                  fill="#8884d8"
                  isAnimationActive={false}
                />
                
                {/* Line for trend */}
                <Line
                  name="Trend Line"
                  type="linear"
                  dataKey="trendValue"
                  stroke="#ff7300"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </Box>
          </>
        )}

        {!loading && data.length === 0 && !error && (
          <Alert severity="info">
            No data available for the selected month and level.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LinearTrend;
