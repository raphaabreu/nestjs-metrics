import { Metric } from './metric';
import { MetricCollector } from './types';
import { SumCollector } from './collectors';

class TestMetric extends Metric {
  name = 'TestMetric';
  unit = 'Count';

  protected createCollector(): MetricCollector {
    return new SumCollector();
  }
}

describe('Metric', () => {
  let metric: TestMetric;

  beforeEach(() => {
    metric = new TestMetric();
  });

  it('should record a single value without labels', () => {
    metric.record(42);
    const result = metric.flush();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('TestMetric');
    expect(result[0].unit).toBe('Count');
    expect(result[0].labels).toEqual({});
    expect(result[0].data).toEqual([{ type: 'sum', value: 42 }]);
    expect(result[0].collectedAt).toBeInstanceOf(Date);
  });

  it('should record multiple values without labels', () => {
    metric.record(10);
    metric.record(20);
    const result = metric.flush();
    expect(result).toHaveLength(1);
    expect(result[0].data).toEqual([{ type: 'sum', value: 30 }]);
  });

  it('should record an array of values', () => {
    metric.record([5, 10, 15]);
    const result = metric.flush();
    expect(result).toHaveLength(1);
    expect(result[0].data).toEqual([{ type: 'sum', value: 30 }]);
  });

  it('should separate data by labels', () => {
    metric.record(10, { country: 'US' });
    metric.record(20, { country: 'UK' });
    metric.record(5, { country: 'US' });

    const result = metric.flush();
    expect(result).toHaveLength(2);

    const us = result.find((r) => r.labels.country === 'US');
    const uk = result.find((r) => r.labels.country === 'UK');

    expect(us).toBeDefined();
    expect(uk).toBeDefined();
    expect(us!.data).toEqual([{ type: 'sum', value: 15 }]);
    expect(uk!.data).toEqual([{ type: 'sum', value: 20 }]);
  });

  it('should treat same labels in different order as identical', () => {
    metric.record(10, { a: '1', b: '2' });
    metric.record(20, { b: '2', a: '1' });

    const result = metric.flush();
    expect(result).toHaveLength(1);
    expect(result[0].data).toEqual([{ type: 'sum', value: 30 }]);
  });

  it('should return empty array when nothing recorded', () => {
    expect(metric.flush()).toEqual([]);
  });

  it('should reset collectors after flush', () => {
    metric.record(42);
    metric.flush();
    expect(metric.flush()).toEqual([]);
  });

  it('should not include unit when not set', () => {
    class NoUnitMetric extends Metric {
      name = 'NoUnit';
      protected createCollector(): MetricCollector {
        return new SumCollector();
      }
    }
    const m = new NoUnitMetric();
    m.record(1);
    const result = m.flush();
    expect(result[0].unit).toBeUndefined();
  });

  it('should include namespace when set', () => {
    class NamespacedMetric extends Metric {
      name = 'Namespaced';
      namespace = 'custom/ns';
      protected createCollector(): MetricCollector {
        return new SumCollector();
      }
    }
    const m = new NamespacedMetric();
    m.record(1);
    const result = m.flush();
    expect(result[0].namespace).toBe('custom/ns');
  });

  it('should not include namespace when not set', () => {
    metric.record(1);
    const result = metric.flush();
    expect(result[0].namespace).toBeUndefined();
  });

  it('should record to multiple label sets from an array', () => {
    metric.record(1, [
      {},
      { Exchange: 'openrtb' },
      { Exchange: 'openrtb', Reason: 'timeout' },
    ]);

    const result = metric.flush();
    expect(result).toHaveLength(3);

    const noLabels = result.find((r) => Object.keys(r.labels).length === 0);
    const exchangeOnly = result.find(
      (r) => Object.keys(r.labels).length === 1 && r.labels.Exchange === 'openrtb',
    );
    const both = result.find(
      (r) => Object.keys(r.labels).length === 2,
    );

    expect(noLabels!.data).toEqual([{ type: 'sum', value: 1 }]);
    expect(exchangeOnly!.data).toEqual([{ type: 'sum', value: 1 }]);
    expect(both!.data).toEqual([{ type: 'sum', value: 1 }]);
  });

  it('should accumulate across calls with array labels', () => {
    metric.record(5, [{}, { Exchange: 'openrtb' }]);
    metric.record(3, [{ Exchange: 'openrtb' }]);

    const result = metric.flush();
    expect(result).toHaveLength(2);

    const noLabels = result.find((r) => Object.keys(r.labels).length === 0);
    const exchange = result.find((r) => r.labels.Exchange === 'openrtb');

    expect(noLabels!.data).toEqual([{ type: 'sum', value: 5 }]);
    expect(exchange!.data).toEqual([{ type: 'sum', value: 8 }]);
  });

  it('should record array of values to multiple label sets', () => {
    metric.record([2, 3], [{}, { region: 'us' }]);

    const result = metric.flush();
    expect(result).toHaveLength(2);

    const noLabels = result.find((r) => Object.keys(r.labels).length === 0);
    const region = result.find((r) => r.labels.region === 'us');

    expect(noLabels!.data).toEqual([{ type: 'sum', value: 5 }]);
    expect(region!.data).toEqual([{ type: 'sum', value: 5 }]);
  });
});
