import { useState, useEffect } from 'react';

export function usePerformance() {
  const [isLowEnd, setIsLowEnd] = useState(false);

  useEffect(() => {
    let lowEnd = false;
    let batteryRef = null;
    let batteryHandler = null;
    let cancelled = false;
    
    // Check device memory (RAM <= 4GB often struggles with heavy WebGL/Animations)
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) {
      lowEnd = true;
    }
    
    // Check CPU cores (<= 4 cores is typically lower-end or mobile)
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
      lowEnd = true;
    }

    // Check connection for data/battery saving
    if (navigator.connection && (navigator.connection.saveData || navigator.connection.effectiveType === '2g' || navigator.connection.effectiveType === '3g')) {
      lowEnd = true;
    }

    setIsLowEnd(lowEnd);

    // Check battery API if available
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        if (cancelled) return;
        const updateBattery = () => {
          // If battery is extremely low or charging is false and level < 20%
          if (!battery.charging && battery.level <= 0.2) {
            setIsLowEnd(true);
            document.documentElement.classList.add('low-power-mode');
          } else {
            setIsLowEnd(lowEnd);
            if (!lowEnd) document.documentElement.classList.remove('low-power-mode');
          }
        };

        batteryRef = battery;
        batteryHandler = updateBattery;
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      }).catch(() => {});
    }

    // Apply global CSS class to disable heavy effects on low-end devices
    if (lowEnd) {
      document.documentElement.classList.add('low-power-mode');
    } else {
      document.documentElement.classList.remove('low-power-mode');
    }
    
    return () => {
      cancelled = true;
      // The battery object outlives this hook, so its listeners have to be
      // detached explicitly or they keep firing setState on an unmounted tree.
      if (batteryRef && batteryHandler) {
        batteryRef.removeEventListener('levelchange', batteryHandler);
        batteryRef.removeEventListener('chargingchange', batteryHandler);
      }
      document.documentElement.classList.remove('low-power-mode');
    };
  }, []);

  return { isLowEnd };
}