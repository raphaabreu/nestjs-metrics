import { SumCollector } from './sum-collector';

describe('SumCollector', () => {
  let collector: SumCollector;

  beforeEach(() => {
    collector = new SumCollector();
  });

  it('should return empty array when nothing collected', () => {
    expect(collector.drain()).toEqual([]);
  });

  it('should collect a single value', () => {
    collector.collect(42);
    expect(collector.drain()).toEqual([{ type: 'sum', value: 42 }]);
  });

  it('should sum multiple values', () => {
    collector.collect(10);
    collector.collect(20);
    collector.collect(30);
    expect(collector.drain()).toEqual([{ type: 'sum', value: 60 }]);
  });

  it('should reset after drain', () => {
    collector.collect(100);
    collector.drain();
    expect(collector.drain()).toEqual([]);
  });

  it('should handle zero values', () => {
    collector.collect(0);
    expect(collector.drain()).toEqual([{ type: 'sum', value: 0 }]);
  });

  it('should handle negative values', () => {
    collector.collect(-5);
    collector.collect(3);
    expect(collector.drain()).toEqual([{ type: 'sum', value: -2 }]);
  });
});
