import React, { useState, memo } from 'react';
import { Drawer, Tabs, Tab, Box, IconButton } from '@mui/material';
import { Close as CloseIcon, Dataset as DatasetIcon, CalendarToday as CalendarIcon, Brush as BrushIcon, Info as InfoIcon } from '@mui/icons-material';
import TabsContent from './TabsContent';

// Memoize to prevent rerenders unless props change
function Sidebar({ open, onClose }) {
  const [tabValue, setTabValue] = useState(0);

  const tabs = [
    { label: 'Datasets', icon: <DatasetIcon /> },
    { label: 'Date', icon: <CalendarIcon /> },
    { label: 'Draw', icon: <BrushIcon /> },
    { label: 'Info', icon: <InfoIcon /> },
  ];

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '80%', sm: 300 },
          maxWidth: '100%',
          bgcolor: '#ffffff',
          transition: 'transform 0.3s ease-in-out',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
        <IconButton onClick={onClose} aria-label="close sidebar">
          <CloseIcon />
        </IconButton>
      </Box>
      <Tabs
        value={tabValue}
        onChange={(e, newValue) => setTabValue(newValue)}
        orientation="horizontal"
        centered
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 'medium',
            minWidth: 0,
            px: 2,
          },
          '& .Mui-selected': {
            color: '#0288D1',
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#0288D1',
          },
        }}
      >
        {tabs.map((tab, index) => (
          <Tab key={tab.label} icon={tab.icon} label={tab.label} aria-label={tab.label} />
        ))}
      </Tabs>
      <TabsContent tabValue={tabValue} />
    </Drawer>
  );
}

export default memo(Sidebar, (prevProps, nextProps) => {
  return prevProps.open === nextProps.open && prevProps.onClose === nextProps.onClose;
});