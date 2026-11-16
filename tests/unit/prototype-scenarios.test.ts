import { describe, expect, it } from 'vitest';
import { SCENARIOS, scenarioOptions } from '../../src/client-v2/prototype/scenarios.js';

const EXPECTED_NAMES = [
  'work',
  'first',
  'failed',
  'waiting',
  'saved',
  'issued',
  'refusal',
  'returned',
];

describe('prototype scenarios', () => {
  it('maps known hashes to demo api options', () => {
    expect(scenarioOptions('#first').apiOptions.empty).toBe(true);
    expect(scenarioOptions('#failed').apiOptions.failLists).toBe(true);
    expect(scenarioOptions('#waiting').apiOptions.holdActions).toBe(true);
    expect(scenarioOptions('#saved').apiOptions.failListsAfterAction).toBe(true);
    expect(scenarioOptions('#first').name).toBe('first');
    // Состояния «Выдано», «Отказ», «Возвращено» получаются действием, а не опциями
    for (const hash of ['#issued', '#refusal', '#returned']) {
      expect(scenarioOptions(hash).apiOptions).toEqual({});
    }
  });

  it('falls back to work scenario for empty or unknown hash', () => {
    for (const hash of [
      '',
      '#',
      '#work',
      '#unknown',
      '#FIRST',
      '#first&x=1',
      '#__proto__',
      '#toString',
    ]) {
      const scenario = scenarioOptions(hash);
      expect(scenario.name, hash).toBe('work');
      expect(scenario.apiOptions, hash).toEqual({});
    }
  });

  it('lists exactly eight scenarios with Russian labels', () => {
    expect(SCENARIOS.map((scenario) => scenario.name)).toEqual(EXPECTED_NAMES);
    for (const scenario of SCENARIOS) {
      expect(scenario.label, scenario.name).toMatch(/[А-Яа-яЁё]/);
      expect(scenario.hint, scenario.name).toMatch(/[А-Яа-яЁё]/);
      expect(scenarioOptions(`#${scenario.name}`)).toBe(scenario);
    }
  });
});
