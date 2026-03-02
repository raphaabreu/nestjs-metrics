import { Injectable } from '@nestjs/common';
import { Metric } from './metric';
import { MetricCollector } from './types';
import { ValuesCollector } from './collectors';

@Injectable()
export abstract class ValuesMetric extends Metric {
  protected createCollector(): MetricCollector {
    return new ValuesCollector();
  }
}
