import { EidolonDBClient } from '../client.js';
import type { ConflictDetectInput, ConflictDetectResult, ConflictResolveInput } from '../types.js';

export class ConflictsResource {
  constructor(private readonly client: EidolonDBClient) {}

  detect(input?: ConflictDetectInput): Promise<ConflictDetectResult> {
    return this.client.request<ConflictDetectResult>('POST', '/conflicts/detect', input ?? {});
  }

  resolve(input: ConflictResolveInput): Promise<{ ok: boolean }> {
    return this.client.request<{ ok: boolean }>('POST', '/conflicts/resolve', input);
  }
}
