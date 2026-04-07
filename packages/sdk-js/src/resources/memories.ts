import { EidolonDBClient } from '../client.js';
import type {
  CreateMemoryInput,
  ListMemoriesOptions,
  ListMemoriesResponse,
  Memory,
  MemorySearchResult,
  MemoryStatsResponse,
  SearchMemoriesOptions,
  UpdateMemoryInput,
} from '../types.js';

export class MemoriesResource {
  constructor(private readonly client: EidolonDBClient) {}

  /** Create a memory. */
  create(input: CreateMemoryInput): Promise<Memory> {
    return this.client.request<Memory>('POST', '/memories', input);
  }

  /** Get a memory by ID. */
  get(id: string): Promise<Memory> {
    return this.client.request<Memory>('GET', `/memories/${id}`);
  }

  /** List memories with optional filters. */
  list(options?: ListMemoriesOptions): Promise<ListMemoriesResponse> {
    return this.client.request<ListMemoriesResponse>('GET', '/memories', undefined, { query: options });
  }

  /** Update a memory. */
  update(id: string, input: UpdateMemoryInput): Promise<Memory> {
    return this.client.request<Memory>('PATCH', `/memories/${id}`, input);
  }

  /** Delete a memory. */
  async delete(id: string): Promise<void> {
    await this.client.request<{ deleted: boolean }>('DELETE', `/memories/${id}`);
  }

  /** Semantic memory search. */
  async search(text: string, options?: SearchMemoriesOptions): Promise<MemorySearchResult[]> {
    const response = await this.client.request<{ results: MemorySearchResult[] }>('POST', '/memories/query', {
      text,
      ...options,
    });

    return response.results;
  }

  /** Record an access against a memory. */
  recordAccess(id: string): Promise<Memory> {
    return this.client.request<Memory>('POST', `/memories/${id}/access`, {});
  }

  /** Fetch memory statistics. */
  stats(): Promise<MemoryStatsResponse> {
    return this.client.request<MemoryStatsResponse>('GET', '/memories/stats');
  }
}
