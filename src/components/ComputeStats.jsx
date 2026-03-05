import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import html2canvas from 'html2canvas';

function ComputeStats({ open, onClose, lat, lon, varName, selectedDataset, selectedLevels, metadata }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const tableRef = useRef(null);

  // Dataset-specific unit fallbacks
  const datasetUnitFallbacks = {
    "air": "mb",
    "NOAA-CIRES Twentieth Century Reanalysis (V2c)": "mb",
  };

  // Fetch statistics
  useEffect(() => {
    if (!open || !selectedDataset || !lat || !lon || !varName) {
      setStats(null);
      setError(null);
      console.log('Skipping stats fetch, invalid params:', { open, selectedDataset: !!selectedDataset, lat, lon, varName });
      return;
    }

    const fetchStats = async () => {
      try {
        const level = metadata.multilevel && selectedLevels.length > 0 ? selectedLevels[0] : 'none';
        const levelParam = level !== 'none' ? `&level=${level}` : '';
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

    fetchStats();
  }, [open, lat, lon, varName, selectedDataset, selectedLevels, metadata.multilevel]);

  // Save table as PNG
  const handleSaveTable = async () => {
    if (tableRef.current) {
      try {
        const canvas = await html2canvas(tableRef.current, { scale: 2 });
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `statistics_${varName}_${lat}_${lon}.png`;
        link.click();
        console.log('Table saved as PNG');
      } catch (err) {
        console.error('Error saving table as PNG:', err);
        alert('Failed to save table as PNG');
      }
    }
  };

  // Determine level display
  const levelUnits = (metadata.level_units || datasetUnitFallbacks[selectedDataset?.name] || 'level').replace('millibar', 'mb');
  const levelDisplay = metadata.multilevel && selectedLevels.length > 0 ? `${selectedLevels[0]} ${levelUnits}` : 'Single Level';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Statistics Summary at ({lat.toFixed(2)}°N, {lon.toFixed(2)}°{lon >= 0 ? 'E' : 'W'}) - {levelDisplay}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        {stats ? (
          <TableContainer component={Paper} ref={tableRef}>
            <Table>
              <TableHead>
                <TableRow>
                  {['Min', '25%', '50%', 'Mean', '75%', 'Max', 'Std', 'Var', 'Skewness', 'Kurtosis'].map((header) => (
                    <TableCell key={header} sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>{stats.min?.toFixed(2) ?? 'N/A'}</TableCell>
                  <TableCell>{stats['25%']?.toFixed(2) ?? 'N/A'}</TableCell>
                  <TableCell>{stats['50%']?.toFixed(2) ?? 'N/A'}</TableCell>
                  <TableCell>{stats.mean?.toFixed(2) ?? 'N/A'}</TableCell>
                  <TableCell>{stats['75%']?.toFixed(2) ?? 'N/A'}</TableCell>
                  <TableCell>{stats.max?.toFixed(2) ?? 'N/A'}</TableCell>
                  <TableCell>{stats.std?.toFixed(2) ?? 'N/A'}</TableCell>
                  <TableCell>{stats.var?.toFixed(2) ?? 'N/A'}</TableCell>
                  <TableCell>{stats.skewness?.toFixed(2) ?? 'N/A'}</TableCell>
                  <TableCell>{stats.kurtosis?.toFixed(2) ?? 'N/A'}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography>Loading statistics...</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onClick={handleSaveTable} disabled={!stats}>
          Save Table
        </Button>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ComputeStats