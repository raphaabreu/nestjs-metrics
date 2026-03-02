import { Injectable } from '@nestjs/common';
import { Metric } from './metric';
import { MetricCollector } from './types';
import { SumCollector } from './collectors';

@Injectable()
export abstract class SumMetric extends Metric {
  protected createCollector(): MetricCollector {
    return new SumCollector();
  }
}
