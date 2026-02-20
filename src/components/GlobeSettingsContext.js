import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';

const GlobeSettingsContext = createContext();

export function GlobeSettingsProvider({ children }) {
  const defaultGraphicalSettings = {
    latLonLines: true,
    pacificCentered: false,
    globeView: '3D Orthographic',
    rivers: 'None',
    lakes: 'None',
    coasts: 'Medium',
    bumpMapping: 'None',
    countries: 'Off',
    smoothedGridboxes: false,
    geographicalLines: false,
    timezones: false,
  };
  const [graphicalSettings, setGraphicalSettings] = useState(() => {
    try {
      const stored = window.localStorage.getItem('graphicalSettings');
      if (!stored) return defaultGraphicalSettings;
      const parsed = JSON.parse(stored);
      return {
        ...defaultGraphicalSettings,
        ...parsed,
        bumpMapping: defaultGraphicalSettings.bumpMapping,
      };
    } catch (error) {
      console.warn('Failed to load graphical settings, using defaults:', error);
      return defaultGraphicalSettings;
    }
  });
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [metadata, setMetadata] = useState({ 
    title: '', 
    units: '', 
    colormap: 'Matlab|Jet', 
    multilevel: false, 
    levels: null, 
    level_units: '' // Initialize level_units
  });
  const [availableDates, setAvailableDates] = useState([]);
  const [colorMapOpen, setColorMapOpen] = useState(false);
  const prevDatasetRef = useRef(null);

  const getFallbackUnits = (varName) => {
    if (!varName) return 'unknown';
    const unitMap = {
      precip: 'mm/day',
      temp: '°C',
      temperature: '°C',
      air: 'K',
      wind: 'm/s',
    };
    return unitMap[varName.toLowerCase()] || 'unknown';
  };

  // Memoized update function to avoid unnecessary rerenders
  const updateGraphicalSettings = useCallback((newSettings) => {
    setGraphicalSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (JSON.stringify(prev) === JSON.stringify(updated)) {
        return prev;
      }
      console.log('Updated graphical settings:', updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('graphicalSettings', JSON.stringify(graphicalSettings));
    } catch (error) {
      console.warn('Failed to persist graphical settings:', error);
    }
  }, [graphicalSettings]);

  // Fetch metadata and dates in context to centralize logic
  useEffect(() => {
    if (!selectedDataset || selectedDataset.relative_path === prevDatasetRef.current) {
      console.log('Skipping metadata/dates fetch: No dataset or same dataset', {
        selectedDataset: selectedDataset?.relative_path,
        prevDataset: prevDatasetRef.current,
      });
      return;
    }

    prevDatasetRef.current = selectedDataset.relative_path;
    console.log('Fetching metadata for', selectedDataset.relative_path);
    fetch(`http://localhost:8080/dataset_info?path=${encodeURIComponent(selectedDataset.relative_path)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        console.log('GlobeSettings metadata:', JSON.stringify(data, null, 2));
        const newColormap = data.colormap || 'Matlab|Jet';
        setMetadata({
          title: data.chosen_variable,
          units: data.units || getFallbackUnits(data.chosen_variable),
          colormap: newColormap,
          multilevel: data.multilevel || false,
          levels: data.levels || null,
          level_units: (data.level_units || null),
        });
        if (data.multilevel && data.levels && data.levels.length > 0 && !selectedLevel) {
          setSelectedLevel(data.levels[0]);
          console.log('Set default level:', data.levels[0]);
        } else if (!data.multilevel) {
          setSelectedLevel(null);
        }
      })
      .catch((err) => {
        console.error('Error fetching metadata:', err);
        setMetadata({
          title: selectedDataset.name,
          units: getFallbackUnits(selectedDataset.name),
          colormap: 'Matlab|Jet',
          multilevel: false,
          levels: null,
          level_units: 'level',
        });
        setSelectedLevel(null);
      });

    console.log('Fetching dates for', selectedDataset.relative_path);
    fetch(`http://localhost:8080/dataset_dates?path=${encodeURIComponent(selectedDataset.relative_path)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch dates: ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        console.log('Fetched dates:', data.dates);
        const validDates = Array.isArray(data.dates) ? data.dates.filter(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) : [];
        setAvailableDates(validDates);
        if (validDates.length > 0) {
          setSelectedDate(validDates[0]);
          console.log('Set default date for new dataset:', validDates[0]);
        } else {
          setSelectedDate(null);
          console.log('No valid dates available, set selectedDate to null');
        }
      })
      .catch((err) => {
        console.error('Error fetching dates:', err);
        setAvailableDates([]);
        setSelectedDate(null);
      });

    return () => {
      prevDatasetRef.current = null;
    };
  }, [selectedDataset, selectedLevel]);

  // Memoize the context value
  const value = useMemo(
    () => ({
      graphicalSettings,
      updateGraphicalSettings,
      selectedDataset,
      setSelectedDataset,
      selectedDate,
      setSelectedDate,
      selectedLevel,
      setSelectedLevel,
      metadata,
      availableDates,
      colorMapOpen,
      setColorMapOpen,
      setColormap: (colormapName) => setMetadata((prev) => ({ ...prev, colormap: colormapName })),
    }),
    [graphicalSettings, updateGraphicalSettings, selectedDataset, selectedDate, selectedLevel, metadata, availableDates, colorMapOpen]
  );

  return (
    <GlobeSettingsContext.Provider value={value}>
      {children}
    </GlobeSettingsContext.Provider>
  );
}

export function useGlobeSettings() {
  const context = useContext(GlobeSettingsContext);
  if (!context) {
    throw new Error('useGlobeSettings must be used within a GlobeSettingsProvider');
  }
  return context;
}