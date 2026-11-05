import {describe,it,expect} from 'vitest';
import {guidanceContextVersion} from '../src/modules/today/guidance-context';
const base={ownerId:'synthetic-owner',localDate:'2026-02-10',timezone:'UTC',selectionVersion:'2026-02-10T10:00:00Z',goalVersion:'2026-02-10T10:00:00Z',profileVersion:'2026-02-10T10:00:00Z',evidence:[{source:'synthetic',raw:1200}]};
describe('transient owner response context',()=>{
 it('changes on owner/source/date/goal and evidence without exposing the tuple',()=>{const token=guidanceContextVersion(base);expect(token).toMatch(/^g1:[a-f0-9]{64}$/);for(const change of [{ownerId:'other'},{localDate:'2026-02-11'},{timezone:'America/Chicago'},{goalVersion:'2026-02-10T11:00:00Z'},{evidence:[{source:'different',raw:1200}]}])expect(guidanceContextVersion({...base,...change})).not.toBe(token);expect(token).not.toContain('synthetic');});
 it('fails closed without versions, stable for key order',()=>{expect(guidanceContextVersion({...base,profileVersion:undefined})).toBeNull();expect(guidanceContextVersion({...base,evidence:[{raw:1200,source:'synthetic'}]})).toBe(guidanceContextVersion(base));});
});
