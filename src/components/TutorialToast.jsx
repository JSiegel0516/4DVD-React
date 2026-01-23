// src/components/TutorialToast.jsx
import React, { useEffect } from 'react';
import { ToastContainer, toast, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from '@mui/material';

export default function TutorialToast({ onGoClick }) {
  useEffect(() => {
    // Check if the toast has been shown before using localStorage
    const hasShownToast = localStorage.getItem('hasShownTutorialToast');

    if (!hasShownToast) {
      const toastId = 'tutorial-toast';

      if (!toast.isActive(toastId)) {
        toast.info(
          () => (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>New to 4DVD? Check out the tutorials!</span>
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  if (onGoClick) onGoClick();
                  toast.dismiss(toastId);
                  localStorage.setItem('hasShownTutorialToast', 'true');
                }}
              >
                Go
              </Button>
            </div>
          ),
          {
            toastId,
            position: 'bottom-center',
            autoClose: false,
            closeOnClick: false,
            draggable: false,
            transition: Slide,
            closeButton: false,
          }
        );
      }
    }
  }, [onGoClick]);

  return <ToastContainer />;
}