import { EidolonDBClient } from '../client.js';
import type { LifecycleRun, LifecycleRunRequest, LifecycleRunResponse } from '../types.js';

export class LifecycleResource {
  constructor(private readonly client: EidolonDBClient) {}

  /** Trigger lifecycle processing. */
  run(options?: LifecycleRunRequest): Promise<LifecycleRunResponse> {
    return this.client.request<LifecycleRunResponse>('POST', '/lifecycle/run', options ?? {});
  }

  /** List recent lifecycle runs. */
  async listRuns(options?: { limit?: number }): Promise<LifecycleRun[]> {
    const response = await this.client.request<{ runs: LifecycleRun[] }>(
      'GET',
      '/lifecycle/runs',
      undefined,
      { query: options }
    );

    return response.runs;
  }
}
