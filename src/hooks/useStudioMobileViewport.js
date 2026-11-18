import * as React from 'react';

// Portrait phones and short landscape phones must stay in the recording-first
// workspace even when rotating crosses Tailwind's 768px desktop breakpoint.
// Full-size tablets/laptops keep the professional desktop editor.
export const STUDIO_LANDSCAPE_PHONE_QUERY =
  '(orientation: landscape) and (max-width: 1024px) and (max-height: 540px)';

export function studioMobileViewport(width,height) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return {mobile:false,landscape:false};
  const landscape = width > height && width <= 1024 && height <= 540;
  return {mobile: width < 768 || landscape, landscape};
}

export function useStudioMobileViewport() {
  const [viewport,setViewport] = React.useState(() =>
    typeof window === 'undefined' ? {mobile:false,landscape:false} :
      studioMobileViewport(window.innerWidth,window.innerHeight));
  React.useEffect(() => {
    const update = () => setViewport(studioMobileViewport(window.innerWidth,window.innerHeight));
    window.addEventListener('resize',update);
    window.addEventListener('orientationchange',update);
    update();
    return () => {
      window.removeEventListener('resize',update);
      window.removeEventListener('orientationchange',update);
    };
  },[]);
  return viewport;
}
