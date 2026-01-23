//src/components/TutorialMenu.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Typography,
  Box,
  IconButton,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';
import MenuIcon from '@mui/icons-material/Menu'; // Added import for hamburger menu icon

// Centralized styles
const styles = {
  demoBox: {
    backgroundColor: '#d3d3d3',
    width: '160px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 1,
  },
  actionButton: {
    backgroundColor: '#ffffff',
    color: '#000000',
    fontWeight: 'bold',
    '&:hover': {
      backgroundColor: '#f0f0f0',
    },
  },
  navButton: {
    backgroundColor: '#e0e0e0',
    color: '#000',
  },
  closeButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    color: (theme) => theme.palette.grey[500],
  },
  tabButton: {
    borderRadius: '50%',
    minWidth: 40,
  },
};

// Page content configuration
const pageContent = {
  1: {
    title: 'Welcome to 4DVD!',
    content: (
      <>
        <Typography variant="h6" gutterBottom align="center" sx={{ textDecoration: 'underline' }}>
          Brief Description
        </Typography>
        <Typography paragraph align="center">
          4-Dimensional Visual Delivery of Big Climate Data, or 4DVD, is a digital technology that can
          quickly and easily visualize and deliver historical climate data. The technology is a software
          and has a friendly website interface. The 4DVD software can be applied to visualize and deliver
          any kind of space-time data, ranging from air temperature to precipitation to wind speeds to
          even humidity. Because of its friendly interface and fast speed, 4DVD can deliver historical
          climate data to the general public, school students, and seniors, in addition to scientists.
        </Typography>
        <Typography variant="h6" gutterBottom align="center" sx={{ mt: 4 }}>
          Prefer another style of tutorial?
        </Typography>
        <Box textAlign="center" mb={2}>
          <Box sx={{ mb: 2 }}>
            <iframe
              width="560"
              height="315"
              src="https://www.youtube.com/embed/VFvWAFo4Lp8"
              title="4DVD Tutorial Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ maxWidth: '100%' }}
            />
          </Box>
          <Button
            variant="contained"
            href="/assets/BasicFunctions4DVDTutorial.pdf"
            target="_blank"
            rel="noopener noreferrer"
            sx={styles.actionButton}
          >
            Basic Functions of 4DVD Tutorial PDF
          </Button>
        </Box>
      </>
    ),
  },
  2: {
    title: 'Top Row',
    content: (
      <>
        <Typography paragraph align="center">
          "Top Row" refers to the blue bar at the top of the 4DVD website.
        </Typography>
        <Divider />
        <Stack spacing={4} mt={4}>
          {/* Row 1: Logo & Top Datasets */}
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Typography flex={1}>Click the 4DVD Logo to refresh the page</Typography>
            <Box sx={styles.demoBox}>
              <img src="/assets/4DVDLogoV1.png" alt="4DVD Logo" style={{ maxHeight: '60px' }} />
            </Box>
            <Typography flex={1}>Click Top Datasets to view our top picked datasets</Typography>
            <Box sx={styles.demoBox}>
              <Button variant="contained" sx={styles.actionButton}>
                Top Datasets
              </Button>
            </Box>
          </Box>
          {/* Row 2: Datasets & Download Data */}
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Typography flex={1}>
              Click Datasets to open an advanced menu<br />to view all the datasets 4DVD has to offer
            </Typography>
            <Box sx={styles.demoBox}>
              <Button variant="contained" sx={styles.actionButton}>
                Datasets
              </Button>
            </Box>
            <Typography flex={1}>
              Click Download Data to download a csv of the global data at the current date and level
            </Typography>
            <Box sx={styles.demoBox}>
              <Button variant="contained" sx={styles.actionButton}>
                Download Data
              </Button>
            </Box>
          </Box>
          {/* Row 3: About */}
          <Box display="flex" alignItems="center" gap={2}>
            <Box flex={1} display="flex" alignItems="center" gap={20}>
              <Typography>Click About for more info on 4DVD</Typography>
              <Box sx={styles.demoBox}>
                <Button startIcon={<InfoIcon />} variant="contained" sx={styles.actionButton}>
                  About
                </Button>
              </Box>
            </Box>
          </Box>
        </Stack>
      </>
    ),
  },
  3: {
    title: 'Main View',
    content: (
      <>
        <Typography paragraph align="center">
          "Main View" refers to everything UNDER the top row.
        </Typography>
        <Divider />
        <Stack spacing={4} mt={4}>
          {/* Row 1: Dataset Menu & Hamburger */}
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Typography flex={1}>
              Click the Title to open the dataset menu. This is an alternative to the dataset button on the top row.
            </Typography>
            <Box sx={styles.demoBox}>
              <Typography sx={{ color: '#000000', fontWeight: 'bold' }}>
                Dataset Type | Data Collection Type
              </Typography>
            </Box>
            <Typography flex={1}>Click the Hamburger to view more settings in a conventional menu.</Typography>
            <Box sx={styles.demoBox}>
              <MenuIcon sx={{ color: '#000000', fontSize: '24px' }} />
            </Box>
          </Box>
          {/* Row 2: Legend & Arrow Button */}
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Typography flex={1}>
              Click the Legend to open the Color Map Menu (shown later in the tutorial).
            </Typography>
            <Box sx={styles.demoBox}>
              <Typography sx={{ color: '#000000' }}>
                *Located underneath the About button*
              </Typography>
            </Box>
            <Typography flex={1}>
              Click the Arrow button above the Legend to show the Legend Slider.
            </Typography>
            <Box sx={styles.demoBox}>
              <Typography sx={{ color: '#000000', fontSize: '24px' }}>
                &lt;
              </Typography>
            </Box>
          </Box>
          {/* Row 3: Level & Date */}
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Typography flex={1}>
              Click the Level's value on the bottom right to change the current Level.
            </Typography>
            <Box sx={styles.demoBox}>
              <Typography sx={{ color: '#000000' }}>
                <span style={{ fontWeight: 'bold' }}>Level</span> | date
              </Typography>
            </Box>
            <Typography flex={1}>
              Click the Date value on the bottom right to change the current Date.
            </Typography>
            <Box sx={styles.demoBox}>
              <Typography sx={{ color: '#000000' }}>
                Level | <span style={{ fontWeight: 'bold' }}>date</span>
              </Typography>
            </Box>
          </Box>
        </Stack>
      </>
    ),
  },
  4: {
  title: 'Globe View',
  content: (
    <>
      {/* subtitle under the heading */}
      <Typography variant="subtitle1" gutterBottom>
        "Globe View" refers to just the globe/map of the earth.
      </Typography>

      {/* divider line */}
      <Divider sx={{ mb: 2 }} />

      {/* bigger bullets + text */}
      <List sx={{ pl: 3, fontSize: '1.1rem' /* raises bullet + text size */ }}>
        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemText
            primary='Click anywhere on the globe for the "Time Series Box" to pop up in the bottom left, showing the lat/lon and data value of the place on the globe you clicked at. You will also notice a button to open the Time Series Menu (explained later in the tutorial).'
            primaryTypographyProps={{ variant: 'body1', sx: { fontSize: '1.1rem' } }}
          />
        </ListItem>

        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemText
            primary="Drag on the globe to rotate the globe."
            primaryTypographyProps={{ variant: 'body1', sx: { fontSize: '1.1rem' } }}
          />
        </ListItem>

        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemText
            primary="Scroll to zoom in and out of the globe."
            primaryTypographyProps={{ variant: 'body1', sx: { fontSize: '1.1rem' } }}
          />
        </ListItem>

        <ListItem disablePadding>
          <ListItemText
            primary='You can change the globe to be a 2D map if you click the hamburger → paint brush → scroll down to "Globe View".'
            primaryTypographyProps={{ variant: 'body1', sx: { fontSize: '1.1rem' } }}
          />
        </ListItem>
      </List>
    </>
  ),
},
  5: {
    title: 'Time Series Menu',
    content: (
      <Typography paragraph align="center">
        Understand how to navigate and use the Time Series Menu for temporal data analysis.
      </Typography>
    ),
  },
  6: {
  title: 'Color Map Menu',
  content: (
    <>
      {/* subtitle under the heading */}
      <Typography variant="subtitle1" gutterBottom>
        The "Color Map Menu" features a large collection of different ways to color the globe to suit your needs. The default color map is Color Brewer 2.0 | Diverging | Non Centered | 11-class Spectral Inverse.
      </Typography>

      {/* divider line */}
      <Divider sx={{ mb: 2 }} />

      {/* bigger bullets + text */}
      <List sx={{ pl: 3, fontSize: '1.1rem' /* raises bullet + text size */ }}>
        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemText
            primary='Click on the Legend (under the About button on the Top Row) to open the Color Map Menu.'
            primaryTypographyProps={{ variant: 'body1', sx: { fontSize: '1.1rem' } }}
          />
        </ListItem>

        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemText
            primary="The Color Map Menu is organized under 6 buttons. 4 Color Brewer 2.0 options, Matlab, and Other."
            primaryTypographyProps={{ variant: 'body1', sx: { fontSize: '1.1rem' } }}
          />
        </ListItem>

        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemText
            primary='You can also click the "Inverse Color Maps" slider at the top of the Color Map Menu to use the inverse versions of the color maps.'
            primaryTypographyProps={{ variant: 'body1', sx: { fontSize: '1.1rem' } }}
          />
        </ListItem>
      </List>
    </>
  ),
},
};

// Navigation Tabs Component
function NavigationTabs({ currentPage, onTabClick }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ mb: 4 }}>
      {Object.keys(pageContent).map((page) => (
        <Box key={page} textAlign="center">
          <Button
            variant={currentPage === parseInt(page) ? 'contained' : 'outlined'}
            onClick={() => onTabClick(parseInt(page))}
            sx={styles.tabButton}
          >
            {page}
          </Button>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {pageContent[page].title}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

// Main Tutorial Menu Component
export default function TutorialMenu({ open, onClose }) {
  const [currentPage, setCurrentPage] = useState(1);

  const handleNext = () => {
    if (currentPage < Object.keys(pageContent).length) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" scroll="paper">
      <DialogTitle sx={{ m: 0, p: 2 }}>
        Tutorial Menu
        <IconButton aria-label="close" onClick={onClose} sx={styles.closeButton}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <NavigationTabs currentPage={currentPage} onTabClick={setCurrentPage} />
        <Typography variant="h4" gutterBottom align="center">
          {pageContent[currentPage].title}
        </Typography>
        {pageContent[currentPage].content}
        <Box display="flex" justifyContent="space-between" mt={4}>
          <Button
            variant="contained"
            onClick={handlePrevious}
            disabled={currentPage === 1}
            sx={styles.navButton}
          >
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={currentPage === Object.keys(pageContent).length}
            sx={styles.navButton}
          >
            Next
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}