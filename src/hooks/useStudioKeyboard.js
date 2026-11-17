import { useEffect, useRef } from 'react';
import { createStudioKeyHandler } from '@/lib/studioKeyHandler';

/**
 * Binds the Studio keyboard shortcuts once, and rebuilds the handler after every
 * render from a fresh dependency factory. Shortcuts therefore always act on the
 * current state (zoom, loop, metronome, nudge value, selection, save handler)
 * instead of a stale closure from the first render. The factory keeps this call
 * safe to place before later `const` handlers are initialized in the component.
 */
export function useStudioKeyboard(depsFactory) {
  const handlerRef = useRef(null);

  useEffect(() => {
    handlerRef.current = createStudioKeyHandler(depsFactory());
  });

  useEffect(() => {
    const onKeyDown = (event) => handlerRef.current?.(event);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}