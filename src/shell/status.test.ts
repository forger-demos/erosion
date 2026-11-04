import {describe, expect, test} from 'bun:test';
import {describeStatus, idleMessage, type StatusInput} from './status';

const base: StatusInput = {terrainFailed: false, failure: null, starting: false, replayingTo: null, exporting: false, exportResult: null, surfaceNote: null, hasRun: true};

describe('describeStatus', () => {
  test('is empty once a run is on screen and nothing is happening', () => {
    expect(describeStatus(base)).toBe('');
  });

  test('tells a viewer with no run yet what to do', () => {
    expect(describeStatus({...base, hasRun: false})).toBe(idleMessage);
  });

  test('names each progress state', () => {
    expect(describeStatus({...base, starting: true})).toContain('Starting');
    expect(describeStatus({...base, replayingTo: 120})).toBe('Replaying to step 120...');
    expect(describeStatus({...base, exporting: true})).toContain('export');
  });

  test('shows the outcome of an export, failed or saved', () => {
    expect(describeStatus({...base, exportResult: 'The export failed: no space.'})).toBe('The export failed: no space.');
  });

  test('explains a missing 3D view and says what is shown instead', () => {
    expect(describeStatus({...base, surfaceNote: 'WebGL2 is not available in this browser.'})).toBe('WebGL2 is not available in this browser. The 2D relief is shown instead.');
  });

  test('a failure outranks progress, and a dead canvas outranks everything', () => {
    expect(describeStatus({...base, failure: 'The simulation stopped: boom', starting: true, exporting: true})).toBe('The simulation stopped: boom');
    expect(describeStatus({...base, terrainFailed: true, failure: 'x'})).toContain('2D canvas');
  });
});
