import { ValuesCollector } from './values-collector';

describe('ValuesCollector', () => {
  let collector: ValuesCollector;

  beforeEach(() => {
    collector = new ValuesCollector();
  });

  it('should return empty array when nothing collected', () => {
    expect(collector.drain()).toEqual([]);
  });

  it('should collect a single value', () => {
    collector.collect(123.456);
    const result = collector.drain();
    expect(result).toEqual([{ type: 'values', values: [123.456], counts: [1] }]);
  });

  it('should collect multiple distinct values', () => {
    collector.collect(123.456);
    collector.collect(234.567);
    collector.collect(345.678);
    const result = collector.drain();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('values');
    if (result[0].type === 'values') {
      expect(result[0].values).toEqual([123.456, 234.567, 345.678]);
      expect(result[0].counts).toEqual([1, 1, 1]);
    }
  });

  it('should accumulate counts for the same value', () => {
    collector.collect(123.456);
    collector.collect(123.456);
    const result = collector.drain();
    expect(result).toEqual([{ type: 'values', values: [123.456], counts: [2] }]);
  });

  it('should reset after drain', () => {
    collector.collect(42);
    collector.drain();
    expect(collector.drain()).toEqual([]);
  });

  it('should split into chunks of 150 values', () => {
    for (let i = 0; i < 300; i++) {
      collector.collect(i);
    }

    const result = collector.drain();
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('values');
    expect(result[1].type).toBe('values');
    if (result[0].type === 'values' && result[1].type === 'values') {
      expect(result[0].values).toHaveLength(150);
      expect(result[1].values).toHaveLength(150);
      expect(result[0].counts.every((c) => c === 1)).toBe(true);
      expect(result[1].counts.every((c) => c === 1)).toBe(true);
    }
  });
});
