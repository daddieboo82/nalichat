// @vitest-environment jsdom
import { describe,expect,it,beforeEach } from 'vitest';
import { getRememberedWorldForPath, rememberWorldContext, resolveWorldForLocation } from '../lib/nalibaseWorldContext';
describe('NaliBase mall continuity across refresh',()=>{
 beforeEach(()=>sessionStorage.clear());
 it('remembers a valid shared-storefront mall within the browser session',()=>{ rememberWorldContext('visualize'); expect(getRememberedWorldForPath('/studio')).toBe('visualize'); expect(resolveWorldForLocation('/studio')?.id).toBe('visualize'); });
 it('does not leak remembered mall identity onto unrelated routes',()=>{ rememberWorldContext('visualize'); expect(getRememberedWorldForPath('/messages')).toBe(''); expect(resolveWorldForLocation('/messages')?.id).toBe('connect'); });
 it('lets explicit navigation state replace the remembered mall',()=>{ rememberWorldContext('visualize'); expect(resolveWorldForLocation('/studio','share')?.id).toBe('share'); expect(getRememberedWorldForPath('/studio')).toBe('share'); });
});
