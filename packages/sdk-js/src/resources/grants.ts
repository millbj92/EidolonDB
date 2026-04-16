import { EidolonDBClient } from '../client.js';
import type { CreateGrantInput, Grant, ListGrantsQuery } from '../types.js';

export class GrantsResource {
  constructor(private readonly client: EidolonDBClient) {}

  create(input: CreateGrantInput): Promise<Grant> {
    return this.client.request<Grant>('POST', '/grants', input);
  }

  list(query?: ListGrantsQuery): Promise<{ grants: Grant[]; total: number }> {
    return this.client.request<{ grants: Grant[]; total: number }>('GET', '/grants', undefined, { query });
  }

  get(id: string): Promise<Grant> {
    return this.client.request<Grant>('GET', `/grants/${id}`);
  }

  async delete(id: string): Promise<void> {
    await this.client.request<unknown>('DELETE', `/grants/${id}`);
  }
}
