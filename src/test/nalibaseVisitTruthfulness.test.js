import { describe, expect, it, beforeEach } from 'vitest';
import { getLastVisitedWorld, resolveWorldForLocation } from '../lib/nalibaseWorldContext';
describe('NaliBase recent-world truthfulness',()=>{
 beforeEach(()=>window.sessionStorage.clear());
 it('does not count shared storefront resolution as a world visit',()=>{ expect(resolveWorldForLocation('/studio','visualize')?.id).toBe('visualize'); expect(getLastVisitedWorld()).toBeNull(); });
 it('still preserves explicit mall continuity for shared storefronts',()=>{ resolveWorldForLocation('/studio','share'); expect(resolveWorldForLocation('/studio')?.id).toBe('share'); });
});
