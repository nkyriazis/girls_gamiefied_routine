import { useState } from 'react';

// A touch screen (the kiosk) gets no hover effects. Read once, on the first render: the
// answer doesn't change while the page is open.
export const useTouchDevice = () => {
  const [isTouchDevice] = useState(() => 'ontouchstart' in window || navigator.maxTouchPoints > 0);
  return isTouchDevice;
};
