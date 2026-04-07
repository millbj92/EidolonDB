import { desc, eq } from 'drizzle-orm';
import { db, memories } from '../../common/db/index.js';
import type { EmbeddingsProvider } from '../../common/embeddings/index.js';
import { queryMemories } from '../memories/index.js';
import type { CandidateMemory, DedupStatus } from './schemas.js';

export interface DedupResult {
  status: DedupStatus;
  matchedMemoryId?: string;
  similarity?: number;
}

const VECTOR_DUPLICATE_THRESHOLD = 0.92;
const VECTOR_NEAR_DUPLICATE_THRESHOLD = 0.85;
const JACCARD_DUPLICATE_THRESHOLD = 0.92;
const JACCARD_NEAR_DUPLICATE_THRESHOLD = 0.85;
const JACCARD_REVIEW_THRESHOLD = 0.75;

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/\u0000/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toWordSet(text: string): Set<string> {
  const normalized = normalizeForComparison(text);
  if (!normalized) {
    return new Set();
  }

  return new Set(normalized.split(' '));
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = toWordSet(a);
  const setB = toWordSet(b);

  if (setA.size === 0 && setB.size === 0) {
    return 1;
  }

  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount += 1;
    }
  }

  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

function statusFromLexicalSimilarity(similarity: number): DedupStatus {
  if (similarity >= JACCARD_DUPLICATE_THRESHOLD) {
    return 'duplicate';
  }

  if (similarity >= JACCARD_NEAR_DUPLICATE_THRESHOLD) {
    return 'near_duplicate';
  }

  if (similarity >= JACCARD_REVIEW_THRESHOLD) {
    return 'needs_review';
  }

  return 'new';
}

export async function checkDedup(
  tenantId: string,
  candidate: CandidateMemory,
  embeddingsProvider?: EmbeddingsProvider
): Promise<DedupResult> {
  const lexicalCandidates = await db
    .select({
      id: memories.id,
      content: memories.content,
    })
    .from(memories)
    .where(eq(memories.tenantId, tenantId))
    .orderBy(desc(memories.createdAt))
    .limit(200);

  let bestLexicalMatch: DedupResult = { status: 'new', similarity: 0 };
  for (const existing of lexicalCandidates) {
    const similarity = jaccardSimilarity(candidate.content, existing.content);
    if ((bestLexicalMatch.similarity ?? 0) < similarity) {
      bestLexicalMatch = {
        status: statusFromLexicalSimilarity(similarity),
        matchedMemoryId: existing.id,
        similarity,
      };
    }
  }

  if (bestLexicalMatch.status === 'duplicate' || bestLexicalMatch.status === 'near_duplicate') {
    return bestLexicalMatch;
  }

  if (embeddingsProvider) {
    const vectorResults = await queryMemories(
      tenantId,
      {
        text: candidate.content,
        k: 1,
        weights: {
          semantic: 1,
          recency: 0,
          importance: 0,
        },
        minScore: 0,
      },
      { embeddingsProvider }
    );

    const bestVector = vectorResults[0];
    if (bestVector) {
      const similarity = bestVector.reasons.semantic;
      if (similarity >= VECTOR_DUPLICATE_THRESHOLD) {
        return {
          status: 'duplicate',
          matchedMemoryId: bestVector.memory.id,
          similarity,
        };
      }

      if (similarity >= VECTOR_NEAR_DUPLICATE_THRESHOLD) {
        return {
          status: 'near_duplicate',
          matchedMemoryId: bestVector.memory.id,
          similarity,
        };
      }
    }
  }

  return bestLexicalMatch;
}
