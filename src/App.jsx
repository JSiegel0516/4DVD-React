import React, { useState, useCallback, memo } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Navbar from './components/Navbar';
import TutorialEntryPoint from './components/TutorialEntryPoint';
import About4DVD from './components/About4DVD';
import GlobeWireframe from './components/GlobeWireframe';
import HamburgerMenu from './components/HamburgerMenu';
import Sidebar from './components/Sidebar';
import TutorialMenu from './components/TutorialMenu';
import DateSelector from './components/DateSelector';
import { GlobeSettingsProvider } from './components/GlobeSettingsContext';

const theme = createTheme({
  palette: { primary: { main: '#0288D1' } },
});

const App = memo(() => {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const handleAboutOpen = useCallback(() => setAboutOpen(true), []);
  const handleAboutClose = useCallback(() => setAboutOpen(false), []);
  const handleSidebarOpen = useCallback(() => setSidebarOpen(true), []);
  const handleSidebarClose = useCallback(() => setSidebarOpen(false), []);
  const handleTutorialOpen = useCallback(() => setTutorialOpen(true), []);
  const handleTutorialClose = useCallback(() => setTutorialOpen(false), []);

  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobeSettingsProvider>
          <Navbar onAboutClick={handleAboutOpen} />
          <HamburgerMenu onClick={handleSidebarOpen} />
          <Sidebar open={sidebarOpen} onClose={handleSidebarClose} />
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <GlobeWireframe />
                  <DateSelector />
                </>
              }
            />
            <Route path="/datasets" element={<div>Datasets Page (TBD)</div>} />
          </Routes>
          <About4DVD
            open={aboutOpen}
            onClose={handleAboutClose}
            onTutorialClick={handleTutorialOpen}
          />
          <TutorialMenu open={tutorialOpen} onClose={handleTutorialClose} />
          <TutorialEntryPoint />
        </GlobeSettingsProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
});

export default App;