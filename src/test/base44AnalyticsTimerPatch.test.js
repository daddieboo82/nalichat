import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {patchBase44AnalyticsTimer} from '../../scripts/base44-analytics-timer-patch.mjs';
const installed=readFileSync('node_modules/@base44/sdk/dist/modules/analytics.js','utf8');
describe('native analytics duration compatibility',()=>{
 it('patches the actual installed SDK startup and clears the timer on stop',()=>{const result=patchBase44AnalyticsTimer(installed);expect(result).not.toBeNull();expect(result).toContain('isStarted = true;\n        if (typeof document !== "undefined" && document.visibilityState === "visible") setSessionDurationTimerStart();');expect(result).toContain('isStarted = false;\n        analyticsSharedState.sessionStartTime = null;');expect(result).toContain('if (isAnalyticsAllowed())\n        start();');});
 it('does not blindly modify unknown SDK layouts',()=>expect(patchBase44AnalyticsTimer('unknown')).toBeNull());
});
