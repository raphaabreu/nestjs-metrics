import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { mergeMap, Observable } from 'rxjs';
import { MetricFlushService } from './metric-flush.service';

@Injectable()
export class MetricFlushInterceptor implements NestInterceptor {
  constructor(private readonly flushService: MetricFlushService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (data) => {
        await this.flushService.flush();
        return data;
      }),
    );
  }
}
