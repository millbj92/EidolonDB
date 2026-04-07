import { EidolonDBClient } from '../client.js';
import type { ContextBuildInput, ContextBuildResponse } from '../types.js';

export class ContextResource {
  constructor(private readonly client: EidolonDBClient) {}

  /** Build LLM-ready context from memories and current input. */
  build(input: ContextBuildInput): Promise<ContextBuildResponse> {
    return this.client.request<ContextBuildResponse>('POST', '/context/build', input);
  }
}
