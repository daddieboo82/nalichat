import { describe, expect, it } from 'vitest';
import { studioRecoveryStorageHealth, isStudioStorageQuotaError } from './studioRecoveryStorageHealth';

describe('mobile recording storage protection', () => {
  const megabyte = 1024 * 1024;
  it('identifies low-space conditions without claiming a write succeeded', async () => {
    const critical = await studioRecoveryStorageHealth({storage:{
      estimate:async()=>({quota:100*megabyte,usage:86*megabyte}),
    },expectedAdditionalBytes:2*megabyte});
    expect(critical.level).toBe('critical');
    expect(critical.freeBytes).toBe(14*megabyte);
    expect(critical.detail).toMatch(/save your Studio session/i);
    const warning = await studioRecoveryStorageHealth({storage:{
      estimate:async()=>({quota:100*megabyte,usage:65*megabyte}),
    },expectedAdditionalBytes:0});
    expect(warning.level).toBe('warning');
    const healthy = await studioRecoveryStorageHealth({storage:{
      estimate:async()=>({quota:100*megabyte,usage:10*megabyte}),
    },expectedAdditionalBytes:5*megabyte});
    expect(healthy.level).toBe('ok');
  });
  it('handles unsupported and unreliable browser storage estimates without crashing recording', async () => {
    expect((await studioRecoveryStorageHealth({storage:null})).level).toBe('unknown');
    expect((await studioRecoveryStorageHealth({storage:{estimate:async()=>{throw Error('private')}}})).level).toBe('unknown');
    expect((await studioRecoveryStorageHealth({storage:{estimate:async()=>({quota:0,usage:5})}})).level).toBe('unknown');
  });
  it('recognizes quota errors separately from WebKit Blob serialization failures',()=>{
    expect(isStudioStorageQuotaError({name:'QuotaExceededError'})).toBe(true);
    expect(isStudioStorageQuotaError({message:'No space left on device'})).toBe(true);
    expect(isStudioStorageQuotaError(new Error('The operation failed'))).toBe(false);
  });
});
