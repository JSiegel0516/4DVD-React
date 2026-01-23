import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Switch,
  FormControlLabel,
  Grid,
  Typography,
  Box,
} from '@mui/material';
import { initializeColorMapManager, getColorMapManager } from '../utils/ColorMapManager';

const CATEGORY_FILTERS = [
  { key: 'cb-non', label: 'CB Non-Centered', match: (name) => name.startsWith('Color Brewer 2.0|Diverging|Non Centered') },
  { key: 'cb-zero', label: 'CB Zero-Centered', match: (name) => name.startsWith('Color Brewer 2.0|Diverging|Zero Centered') },
  { key: 'cb-multi', label: 'CB Multi-hue', match: (name) => name.startsWith('Color Brewer 2.0|Sequential|Multi-Hue') },
  { key: 'cb-single', label: 'CB Single-hue', match: (name) => name.startsWith('Color Brewer 2.0|Sequential|Single-Hue') },
  { key: 'matlab', label: 'Matlab', match: (name) => name.startsWith('Matlab|') },
  { key: 'other', label: 'Other', match: () => true },
];

export default function ColorMapMenu({ open, onClose, onSelect }) {
  const [entries, setEntries] = useState([]);
  const [category, setCategory] = useState('cb-non');
  const [showInverse, setShowInverse] = useState(false);

  useEffect(() => {
    if (!open) return;
    initializeColorMapManager().then((mgr) => {
      setEntries(mgr.getColorMaps());
    });
  }, [open]);

  const filteredEntries = useMemo(() => {
    const filter = CATEGORY_FILTERS.find((c) => c.key === category) || CATEGORY_FILTERS[0];
    return entries.filter((cm) => {
      const isInverse = cm.FullName.toLowerCase().includes('inverse');
      if (showInverse && !isInverse) return false;
      if (!showInverse && isInverse) return false;
      return filter.match(cm.FullName);
    });
  }, [entries, category, showInverse]);

  const handleSelect = (cm) => {
    if (onSelect) onSelect(cm.FullName);
    if (onClose) onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Color Maps Available</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <ToggleButtonGroup
            exclusive
            value={category}
            onChange={(_, val) => val && setCategory(val)}
            size="small"
          >
            {CATEGORY_FILTERS.map((c) => (
              <ToggleButton key={c.key} value={c.key}>
                {c.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <FormControlLabel
            control={<Switch checked={showInverse} onChange={(e) => setShowInverse(e.target.checked)} />}
            label="Inverse"
          />
        </Box>
        <Grid container spacing={2}>
          {filteredEntries.map((color, idx) => {
            const gradId = `cm-${color.IdName}-${idx}`;
            return (
              <Grid item xs={12} sm={6} md={4} key={gradId}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <svg width="55" height="55">
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        {color.Gradient.map((g) => (
                          <stop key={`${gradId}-${g.Offset}`} offset={g.Offset} stopColor={g.StopColor} stopOpacity={1} />
                        ))}
                      </linearGradient>
                    </defs>
                    <circle fill={`url(#${gradId})`} cx="27" cy="27" r="27" width="55" height="55" />
                  </svg>
                  <Button variant="text" onClick={() => handleSelect(color)} sx={{ textTransform: 'none' }}>
                    <Typography variant="body2" align="left">
                      {color.FullName}
                    </Typography>
                  </Button>
                </Box>
              </Grid>
            );
          })}
        </Grid>
        {filteredEntries.length === 0 && (
          <Typography variant="body2" sx={{ mt: 2 }}>
            No colormaps found in this category.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
