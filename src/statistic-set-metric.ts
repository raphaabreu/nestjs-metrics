import { Injectable } from '@nestjs/common';
import { Metric } from './metric';
import { MetricCollector } from './types';
import { StatisticSetCollector } from './collectors';

@Injectable()
export abstract class StatisticSetMetric extends Metric {
  protected createCollector(): MetricCollector {
    return new StatisticSetCollector();
  }
}
