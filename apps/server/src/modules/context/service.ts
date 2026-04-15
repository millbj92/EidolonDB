import { queryMemories, type MemoryQueryResult } from '../memories/index.js';
import { getEntityById } from '../entities/index.js';
import type { EmbeddingsProvider } from '../../common/embeddings/index.js';
import type { ContextBuildInput, ContextMessage, ContextBuildResponse } from './schemas.js';
import type { MemoryTier } from '../memories/schemas.js';

export interface ContextBuildOptions {
  embeddingsProvider?: EmbeddingsProvider;
}

interface RankedMemory {
  memory: MemoryQueryResult['memory'];
  score: number;
  tier: MemoryTier;
}

/**
 * Rough token estimation: ~4 characters per token for English text.
 * This is a simple heuristic; production systems should use tiktoken or similar.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build LLM-ready context from memories, entities, and current input.
 *
 * Strategy:
 * 1. Query memories from each requested tier
 * 2. Merge and re-rank results
 * 3. Build messages array with system prompts, context, and memories
 * 4. Trim to fit within maxTokens budget
 */
export async function buildContext(
  tenantId: string,
  input: ContextBuildInput,
  options?: ContextBuildOptions
): Promise<ContextBuildResponse> {
  const { embeddingsProvider } = options ?? {};
  const {
    agentEntityId,
    userEntityId,
    goal,
    currentInput,
    maxTokens,
    strategy,
  } = input;

  const { tiers, perTierCaps, weights, tags } = strategy ?? {};
  const tiersToQuery = tiers ?? ['semantic', 'episodic'];

  // Collect all memories from each tier
  const allMemories: RankedMemory[] = [];
  let totalQueried = 0;

  for (const tier of tiersToQuery) {
    const cap = perTierCaps?.[tier] ?? 20;
    if (cap === 0) continue;

    const results = await queryMemories(
      tenantId,
      {
        text: currentInput,
        k: cap,
        tiers: [tier],
        ownerEntityId: userEntityId ?? agentEntityId,
        tags,
        weights,
        minScore: 0,
        includeShared: false,
      },
      { embeddingsProvider }
    );

    totalQueried += results.length;

    for (const result of results) {
      allMemories.push({
        memory: result.memory,
        score: result.score,
        tier,
      });
    }
  }

  // Sort by score (highest first)
  allMemories.sort((a, b) => b.score - a.score);

  // Build messages
  const messages: ContextMessage[] = [];
  let currentTokens = 0;

  // 1. System prompt (if enabled)
  if (strategy?.includeSystemPrompt !== false) {
    let systemPrompt = 'You are a helpful AI assistant.';

    // Add agent context if available
    if (agentEntityId) {
      const agent = await getEntityById(tenantId, agentEntityId);
      if (agent) {
        systemPrompt = `You are ${agent.name}, an AI assistant.`;
        if (agent.properties && typeof agent.properties === 'object') {
          const props = agent.properties as Record<string, unknown>;
          if (props['description']) {
            systemPrompt += ` ${props['description']}`;
          }
          if (props['personality']) {
            systemPrompt += ` Personality: ${props['personality']}`;
          }
        }
      }
    }

    // Add goal if provided
    if (goal) {
      systemPrompt += `\n\nCurrent goal: ${goal}`;
    }

    const systemTokens = estimateTokens(systemPrompt);
    if (currentTokens + systemTokens <= maxTokens) {
      messages.push({
        role: 'system',
        content: systemPrompt,
        metadata: { source: 'system_prompt' },
      });
      currentTokens += systemTokens;
    }
  }

  // 2. User profile context (if available)
  if (userEntityId) {
    const user = await getEntityById(tenantId, userEntityId);
    if (user) {
      let userContext = `User: ${user.name}`;
      if (user.properties && typeof user.properties === 'object') {
        const props = user.properties as Record<string, unknown>;
        const relevantProps = ['preferences', 'context', 'role', 'department'];
        const details: string[] = [];
        for (const prop of relevantProps) {
          if (props[prop]) {
            details.push(`${prop}: ${JSON.stringify(props[prop])}`);
          }
        }
        if (details.length > 0) {
          userContext += `\n${details.join('\n')}`;
        }
      }

      const userTokens = estimateTokens(userContext);
      if (currentTokens + userTokens <= maxTokens) {
        messages.push({
          role: 'system',
          content: userContext,
          metadata: { source: 'user_profile' },
        });
        currentTokens += userTokens;
      }
    }
  }

  // 3. Relevant memories (fit as many as possible)
  const includedMemories: RankedMemory[] = [];
  const memoryContents: string[] = [];

  for (const rankedMemory of allMemories) {
    const memoryText = rankedMemory.memory.content;
    const memoryTokens = estimateTokens(memoryText);

    // Reserve space for the current input message
    const inputTokens = estimateTokens(currentInput);
    const reservedTokens = inputTokens + 100; // Buffer

    if (currentTokens + memoryTokens + reservedTokens <= maxTokens) {
      includedMemories.push(rankedMemory);
      memoryContents.push(memoryText);
      currentTokens += memoryTokens;
    } else {
      // Stop adding memories if we're out of budget
      break;
    }
  }

  // Add memories as a single system message if we have any
  if (memoryContents.length > 0) {
    const memoriesMessage = `Relevant context from memory:\n\n${memoryContents.map((m, i) => `[${i + 1}] ${m}`).join('\n\n')}`;
    messages.push({
      role: 'system',
      content: memoriesMessage,
      metadata: {
        source: 'memory',
        memoryIds: includedMemories.map((m) => m.memory.id),
      },
    });
  }

  // 4. Current user input
  messages.push({
    role: 'user',
    content: currentInput,
    metadata: { source: 'current_input' },
  });
  currentTokens += estimateTokens(currentInput);

  return {
    messages,
    rawMemories: includedMemories.map((m) => ({
      memory: m.memory,
      score: m.score,
      tier: m.tier,
    })),
    metadata: {
      totalTokensEstimated: currentTokens,
      memoriesIncluded: includedMemories.length,
      memoriesQueried: totalQueried,
      tiersQueried: tiersToQuery,
    },
  };
}
