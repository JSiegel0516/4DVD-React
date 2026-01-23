//src/components/HamburgerMenu.js
import React from 'react';
import { IconButton } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';

export default function HamburgerMenu({ onClick }) {
  return (
    <IconButton
      color="inherit"
      onClick={onClick}
      aria-label="open sidebar menu"
      sx={{
        position: 'absolute',
        top: 72, // Below AppBar (64px height + 8px margin)
        left: 8,
        zIndex: 1200, // Above other content but below Drawer
        color: '#0288D1',
      }}
    >
      <MenuIcon />
    </IconButton>
  );
}