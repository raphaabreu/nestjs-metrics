import { StatisticSetCollector } from './statistic-set-collector';

describe('StatisticSetCollector', () => {
  let collector: StatisticSetCollector;

  beforeEach(() => {
    collector = new StatisticSetCollector();
  });

  it('should return empty array when nothing collected', () => {
    expect(collector.drain()).toEqual([]);
  });

  it('should collect a single value', () => {
    collector.collect(42);
    expect(collector.drain()).toEqual([
      { type: 'statisticSet', min: 42, max: 42, sum: 42, count: 1 },
    ]);
  });

  it('should track min, max, sum, count across multiple values', () => {
    collector.collect(10);
    collector.collect(20);
    collector.collect(5);
    collector.collect(30);
    expect(collector.drain()).toEqual([
      { type: 'statisticSet', min: 5, max: 30, sum: 65, count: 4 },
    ]);
  });

  it('should reset after drain', () => {
    collector.collect(100);
    collector.drain();
    expect(collector.drain()).toEqual([]);
  });

  it('should handle negative values', () => {
    collector.collect(-10);
    collector.collect(5);
    expect(collector.drain()).toEqual([
      { type: 'statisticSet', min: -10, max: 5, sum: -5, count: 2 },
    ]);
  });
});
