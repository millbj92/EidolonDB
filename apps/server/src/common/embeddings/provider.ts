export interface EmbeddingResult {
  vector: number[];
  model: string;
  dim: number;
}

export interface EmbeddingsProvider {
  /**
   * Generate an embedding vector for the given text.
   */
  embedText(text: string): Promise<EmbeddingResult>;

  /**
   * Generate embedding vectors for multiple texts in a batch.
   * More efficient than calling embedText multiple times.
   */
  embedBatch(texts: string[]): Promise<EmbeddingResult[]>;

  /**
   * The model identifier used by this provider.
   */
  readonly model: string;

  /**
   * The dimension of vectors produced by this provider.
   */
  readonly dim: number;
}
