import { EidolonDBClient } from '../client.js';
import type {
  CreateRelationInput,
  ListRelationsOptions,
  ListRelationsResponse,
  Relation,
  TraverseOptions,
  TraverseResult,
} from '../types.js';

export class RelationsResource {
  constructor(private readonly client: EidolonDBClient) {}

  /** Create a relation between two nodes. */
  create(input: CreateRelationInput): Promise<Relation> {
    return this.client.request<Relation>('POST', '/relations', input);
  }

  /** List relations for a source/target node. */
  async list(options?: ListRelationsOptions): Promise<Relation[]> {
    const response = await this.client.request<ListRelationsResponse>('GET', '/relations', undefined, {
      query: options,
    });

    return response.relations;
  }

  /** Get relation by ID. */
  get(id: string): Promise<Relation> {
    return this.client.request<Relation>('GET', `/relations/${id}`);
  }

  /** Delete relation by ID. */
  async delete(id: string): Promise<void> {
    await this.client.request<{ deleted: boolean }>('DELETE', `/relations/${id}`);
  }

  /** Traverse relations graph from a starting node. */
  traverse(options: TraverseOptions): Promise<TraverseResult> {
    return this.client.request<TraverseResult>('GET', '/relations/traverse', undefined, {
      query: {
        ...options,
        relationTypes: options.relationTypes?.join(','),
      },
    });
  }
}
