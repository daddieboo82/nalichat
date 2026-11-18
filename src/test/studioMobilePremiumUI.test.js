import {describe,expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';

describe('NaliChat mobile Studio portrait and landscape visual design',()=>{
  it('keeps portrait tracks above optional microphone setup while preserving two-pane landscape layout',async()=>{
    const css=await readFile('src/styles/studioMobileOrientation.css','utf8');
    const studio=await readFile('src/pages/Studio.jsx','utf8');
    expect(studio).toContain('studio-mobile-workspace studio-mobile-premium');
    expect(studio).toContain('studio-mobile-heading-title');
    expect(css).toContain('.studio-mobile-premium:not(.studio-mobile-landscape) .studio-mobile-tracks-pane{order:1');
    expect(css).toContain('.studio-mobile-premium:not(.studio-mobile-landscape) .studio-mobile-side-pane{');
    expect(css).toContain('order:2;flex:0 0 auto');
    expect(css).toContain('.studio-mobile-landscape .studio-mobile-record-grid { display: grid !important; }');
  });
  it('keeps key controls visible, accessible and non-destructive',async()=>{
    const studio=await readFile('src/pages/Studio.jsx','utf8');
    const tracks=await readFile('src/components/studio/MobileStudioTracks.jsx','utf8');
    const css=await readFile('src/styles/studioMobileOrientation.css','utf8');
    expect(studio).toContain('aria-label="Mobile Studio transport"');
    expect(studio).toContain('aria-label={isRecording ? "Stop recording" : "Record"}');
    expect(studio).toContain('disabled={!canEditProject || mobileTakeFinalizing}');
    expect(tracks).toContain('studio-mobile-track-selected');
    expect(tracks).toContain('aria-pressed={Boolean(track.armed)}');
    expect(tracks).toContain('studio-mobile-review-button');
    expect(tracks).toContain('onReview?.(audio.id)');
    expect(css).toContain('@media (prefers-reduced-motion:reduce)');
  });
});
