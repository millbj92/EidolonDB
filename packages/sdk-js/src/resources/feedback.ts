import { EidolonDBClient } from '../client.js';
import type { MarkUsedResponse, RetrievalStatsResponse } from '../types.js';

export class FeedbackResource {
  constructor(private readonly client: EidolonDBClient) {}

  markUsed(
    memoryIds: string[],
    options?: {
      sessionId?: string;
      actorId?: string;
      relevanceFeedback?: Record<string, number>;
    }
  ): Promise<MarkUsedResponse> {
    return this.client.request<MarkUsedResponse>('POST', '/feedback/mark-used', {
      memoryIds,
      ...options,
    });
  }

  stats(memoryId: string): Promise<RetrievalStatsResponse> {
    return this.client.request<RetrievalStatsResponse>('GET', `/feedback/stats/${memoryId}`);
  }

  async listStats(options?: { limit?: number; sortBy?: string }): Promise<RetrievalStatsResponse[]> {
    const response = await this.client.request<{ stats: RetrievalStatsResponse[] }>(
      'GET',
      '/feedback/stats',
      undefined,
      { query: options }
    );
    return response.stats;
  }
}
