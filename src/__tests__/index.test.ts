import config from '../index';

describe('AI Orchestrator Config', () => {
  it('should have the correct name', () => {
    expect(config.name).toBe('AI Orchestrator Generic');
  });

  it('should have the correct version', () => {
    expect(config.version).toBe('1.0.0');
  });

  it('should have an empty agents array', () => {
    expect(config.agents).toEqual([]);
  });
});
