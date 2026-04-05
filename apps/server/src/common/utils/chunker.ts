export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
}

export interface Chunk {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
}

/**
 * Splits text into overlapping chunks for embedding and retrieval.
 *
 * Strategy: Character-based chunking with sentence-boundary awareness.
 * Attempts to break at sentence boundaries (., !, ?) when possible,
 * falling back to word boundaries, then hard character limits.
 */
export function chunkText(text: string, options: ChunkOptions): Chunk[] {
  const { chunkSize, chunkOverlap } = options;

  if (chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap must be less than chunkSize');
  }

  if (text.length <= chunkSize) {
    return [{
      content: text,
      index: 0,
      startChar: 0,
      endChar: text.length,
    }];
  }

  const chunks: Chunk[] = [];
  let startChar = 0;
  let index = 0;

  while (startChar < text.length) {
    let endChar = Math.min(startChar + chunkSize, text.length);

    // If we're not at the end, try to find a good break point
    if (endChar < text.length) {
      const searchStart = Math.max(startChar + chunkSize - 200, startChar);
      const searchRegion = text.slice(searchStart, endChar);

      // Try sentence boundary first
      const sentenceMatch = searchRegion.match(/[.!?]\s+[A-Z]/g);
      if (sentenceMatch) {
        const lastMatch = searchRegion.lastIndexOf(sentenceMatch[sentenceMatch.length - 1]!);
        if (lastMatch !== -1) {
          endChar = searchStart + lastMatch + 2; // Include the punctuation and space
        }
      } else {
        // Fall back to word boundary
        const lastSpace = text.lastIndexOf(' ', endChar);
        if (lastSpace > startChar + chunkSize / 2) {
          endChar = lastSpace;
        }
      }
    }

    const content = text.slice(startChar, endChar).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        index,
        startChar,
        endChar,
      });
      index++;
    }

    // Move start position, accounting for overlap
    startChar = endChar - chunkOverlap;

    // Avoid infinite loop if overlap is too large relative to actual chunk
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk && startChar <= lastChunk.startChar) {
      startChar = endChar;
    }
  }

  return chunks;
}
