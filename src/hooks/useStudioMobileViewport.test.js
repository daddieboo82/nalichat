import {describe,it,expect} from 'vitest';
import {studioMobileViewport} from './useStudioMobileViewport';
import {readFile} from 'node:fs/promises';

describe('Studio orientation-aware mobile workspaces',()=>{
 it('keeps portrait phones in recording-first UI',()=>{
  expect(studioMobileViewport(390,844)).toEqual({mobile:true,landscape:false});
  expect(studioMobileViewport(320,568)).toEqual({mobile:true,landscape:false});
 });
 it('keeps rotated phones in mobile UI above the desktop breakpoint',()=>{
  expect(studioMobileViewport(844,390)).toEqual({mobile:true,landscape:true});
  expect(studioMobileViewport(932,430)).toEqual({mobile:true,landscape:true});
  expect(studioMobileViewport(667,375)).toEqual({mobile:true,landscape:true});
 });
 it('preserves the professional editor on large tablets and desktop screens',()=>{
  expect(studioMobileViewport(1024,768)).toEqual({mobile:false,landscape:false});
  expect(studioMobileViewport(1200,600)).toEqual({mobile:false,landscape:false});
  expect(studioMobileViewport(820,1180)).toEqual({mobile:false,landscape:false});
 });
 it('shows landscape tabs, individual scrolling panes and transport without reloading tracks',async()=>{
  const studio=await readFile('src/pages/Studio.jsx','utf8');
  const css=await readFile('src/styles/studioMobileOrientation.css','utf8');
  expect(studio).toContain('useStudioMobileViewport()');
  expect(studio).toContain('studio-mobile-record-view');
  expect(studio).toContain('studio-mobile-tracks-pane');
  expect(studio).toContain('studio-mobile-transport');
  expect(studio).toContain('style={{display:isMobile?"flex":"none"}}');
  expect(css).toContain('grid-template-columns: minmax(210px, 38%) minmax(0, 1fr)');
  expect(css).toContain('overflow-y: auto');
  expect(css).toContain('min-height: 44px');
 });
});
