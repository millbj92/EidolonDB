import { EidolonDBClient } from '../client.js';
import type { Artifact, CreateArtifactInput, CreateArtifactResponse, DeleteArtifactResponse } from '../types.js';

export class ArtifactsResource {
  constructor(private readonly client: EidolonDBClient) {}

  /** Create an artifact, optionally auto-processing into memories. */
  create(input: CreateArtifactInput): Promise<CreateArtifactResponse> {
    return this.client.request<CreateArtifactResponse>('POST', '/artifacts', input);
  }

  /** Get an artifact by ID. */
  get(id: string): Promise<Artifact> {
    return this.client.request<Artifact>('GET', `/artifacts/${id}`);
  }

  /** Delete an artifact and related derived memories. */
  delete(id: string): Promise<DeleteArtifactResponse> {
    return this.client.request<DeleteArtifactResponse>('DELETE', `/artifacts/${id}`);
  }
}
