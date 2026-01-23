//src/components/TutorialEntryPoint.jsx
import React, { useState } from 'react';
import TutorialToast from './TutorialToast';
import TutorialMenu from './TutorialMenu';

export default function TutorialEntryPoint() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TutorialToast onGoClick={() => setOpen(true)} />
      <TutorialMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}
