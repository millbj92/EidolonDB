import { EidolonDBClient } from '../client.js';
import type { IngestRequest, IngestResponse } from '../types.js';

export class IngestResource {
  constructor(private readonly client: EidolonDBClient) {}

  /** Run ingest extraction + dedup + optional auto-store. */
  run(input: IngestRequest): Promise<IngestResponse> {
    return this.client.request<IngestResponse>('POST', '/ingest', input);
  }
}
