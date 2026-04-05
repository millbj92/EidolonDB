import { env } from '../config/index.js';
import type { EmbeddingsProvider, EmbeddingResult } from './provider.js';

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const OPENAI_EMBEDDING_DIM = 1536;
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIEmbeddingsProvider implements EmbeddingsProvider {
  readonly model = OPENAI_EMBEDDING_MODEL;
  readonly dim = OPENAI_EMBEDDING_DIM;

  private readonly apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OPENAI_API_KEY is required for OpenAIEmbeddingsProvider');
    }
    this.apiKey = key;
  }

  async embedText(text: string): Promise<EmbeddingResult> {
    const results = await this.embedBatch([text]);
    const result = results[0];
    if (!result) {
      throw new Error('No embedding result returned');
    }
    return result;
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json() as OpenAIEmbeddingResponse;

    // Sort by index to maintain order
    const sorted = data.data.sort((a, b) => a.index - b.index);

    return sorted.map((item) => ({
      vector: item.embedding,
      model: this.model,
      dim: this.dim,
    }));
  }
}
