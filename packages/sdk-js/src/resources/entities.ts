import { EidolonDBClient } from '../client.js';
import type { CreateEntityInput, Entity, ListEntitiesOptions, UpdateEntityInput } from '../types.js';

export class EntitiesResource {
  constructor(private readonly client: EidolonDBClient) {}

  /** Create an entity. */
  create(input: CreateEntityInput): Promise<Entity> {
    return this.client.request<Entity>('POST', '/entities', input);
  }

  /** Get an entity by ID. */
  get(id: string): Promise<Entity> {
    return this.client.request<Entity>('GET', `/entities/${id}`);
  }

  /** List entities. */
  async list(options?: ListEntitiesOptions): Promise<Entity[]> {
    const response = await this.client.request<{ entities: Entity[] }>('GET', '/entities', undefined, {
      query: options,
    });

    return response.entities;
  }

  /** Update an entity. */
  update(id: string, input: UpdateEntityInput): Promise<Entity> {
    return this.client.request<Entity>('PATCH', `/entities/${id}`, input);
  }

  /** Delete an entity. */
  async delete(id: string): Promise<void> {
    await this.client.request<{ deleted: boolean }>('DELETE', `/entities/${id}`);
  }
}
