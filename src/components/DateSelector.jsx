import React, { useState, useCallback, memo } from 'react';
import { Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { useGlobeSettings } from './GlobeSettingsContext';

// Memoize to prevent rerenders unless props change
function DateSelector() {
  const { selectedDate, setSelectedDate, selectedLevel, setSelectedLevel, availableDates, metadata } = useGlobeSettings();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [level, setLevel] = useState('');

  // Extract unique years and months
  const years = [...new Set(availableDates.map(date => date.split('-')[0]))].sort();
  const months = year 
    ? [...new Set(availableDates.filter(date => date.startsWith(year)).map(date => date.split('-')[1]))].sort()
    : [];

  const handleClick = useCallback(() => {
    console.log('DateSelector handleClick:', { selectedDate, selectedLevel });
    setOpen(true);
    if (selectedDate && typeof selectedDate === 'string' && /^\d{4}-\d{2}/.test(selectedDate)) {
      const [y, m] = selectedDate.split('-');
      setYear(y);
      setMonth(m);
    } else {
      setYear('');
      setMonth('');
    }
    if (selectedLevel) {
      setLevel(selectedLevel);
    }
  }, [selectedDate, selectedLevel]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setYear('');
    setMonth('');
    setLevel('');
  }, []);

  const handleConfirm = useCallback(() => {
    if (year && month) {
      // Find first available date for the selected month/year
      const matchingDates = availableDates.filter(date => date.startsWith(`${year}-${month}`));
      if (matchingDates.length > 0) {
        const newDate = matchingDates[0];
        setSelectedDate(newDate);
        console.log('Selected date:', newDate);
      }
    }
    if (metadata.multilevel && level) {
      setSelectedLevel(parseFloat(level));
      console.log('Selected level:', level);
    }
    handleClose();
  }, [year, month, level, availableDates, setSelectedDate, setSelectedLevel, metadata.multilevel, handleClose]);

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1000,
          cursor: 'pointer',
        }}
        onClick={handleClick}
      >
        <Typography variant="h6" sx={{ color: 'black', fontWeight: 'bold', fontSize: '36px', lineHeight: 1.1 }}>
          {selectedDate && typeof selectedDate === 'string' ? selectedDate.substring(0, 7) : (availableDates.length === 0 ? 'No dates available' : 'Choose Date')}
        </Typography>
        {metadata.multilevel && selectedLevel && (
          <Typography variant="body1" sx={{ color: 'black', fontSize: '1.25rem', fontWeight: 600 }}>
            Level: {selectedLevel} mb
          </Typography>
        )}
      </Box>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Select Date and Level</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Year</InputLabel>
              <Select
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setMonth('');
                }}
                label="Year"
              >
                {years.length > 0 ? (
                  years.map((y) => (
                    <MenuItem key={y} value={y}>{y}</MenuItem>
                  ))
                ) : (
                  <MenuItem value="" disabled>No years available</MenuItem>
                )}
              </Select>
            </FormControl>
            {year && (
              <FormControl fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  label="Month"
                >
                  {months.length > 0 ? (
                    months.map((m) => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>No months available</MenuItem>
                  )}
                </Select>
              </FormControl>
            )}
            {metadata.multilevel && (
              <FormControl fullWidth>
                <InputLabel>Level</InputLabel>
                <Select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  label="Level"
                >
                  {metadata.levels.length > 0 ? (
                    metadata.levels.map((lvl) => (
                      <MenuItem key={lvl} value={lvl}>{lvl} mb</MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>No levels available</MenuItem>
                  )}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={!year || !month || (metadata.multilevel && !level)}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default memo(DateSelector, () => true);