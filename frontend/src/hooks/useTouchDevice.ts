import { useState, useEffect } from 'react';

export const useTouchDevice = () => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Check for touch capability
    const hasTouchScreen = 'ontouchstart' in window || 
                          navigator.maxTouchPoints > 0 || 
                          (navigator as any).msMaxTouchPoints > 0;
    
    setIsTouchDevice(hasTouchScreen);
  }, []);

  return isTouchDevice;
};
