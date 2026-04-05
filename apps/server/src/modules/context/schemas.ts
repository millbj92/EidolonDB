import { z } from 'zod';
import { memoryTierSchema, memoryResponseSchema } from '../memories/schemas.js';

export const contextBuildSchema = z.object({
  // Core identifiers
  agentEntityId: z.string().uuid().optional(),
  userEntityId: z.string().uuid().optional(),

  // Current context
  goal: z.string().optional(),
  currentInput: z.string().min(1),

  // Budget
  maxTokens: z.number().min(100).max(128000).default(4000),

  // Strategy options
  strategy: z.object({
    // Which memory tiers to query
    tiers: z.array(memoryTierSchema).optional().default(['semantic', 'episodic']),

    // Per-tier caps (max memories per tier)
    perTierCaps: z.object({
      short_term: z.number().min(0).max(50).optional().default(10),
      episodic: z.number().min(0).max(50).optional().default(10),
      semantic: z.number().min(0).max(50).optional().default(20),
    }).optional().default({}),

    // Scoring weights
    weights: z.object({
      semantic: z.number().min(0).max(1).optional().default(0.7),
      recency: z.number().min(0).max(1).optional().default(0.2),
      importance: z.number().min(0).max(1).optional().default(0.1),
    }).optional().default({}),

    // Optional filters
    tags: z.array(z.string()).optional(),
    topics: z.array(z.string()).optional(),

    // Include system prompt template
    includeSystemPrompt: z.boolean().optional().default(true),
  }).optional().default({}),
});

export type ContextBuildInput = z.infer<typeof contextBuildSchema>;

export const contextMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
  metadata: z.object({
    source: z.enum(['system_prompt', 'memory', 'user_profile', 'agent_profile', 'current_input']).optional(),
    memoryIds: z.array(z.string().uuid()).optional(),
  }).optional(),
});

export type ContextMessage = z.infer<typeof contextMessageSchema>;

export const contextBuildResponseSchema = z.object({
  messages: z.array(contextMessageSchema),
  rawMemories: z.array(z.object({
    memory: memoryResponseSchema,
    score: z.number(),
    tier: memoryTierSchema,
  })),
  metadata: z.object({
    totalTokensEstimated: z.number(),
    memoriesIncluded: z.number(),
    memoriesQueried: z.number(),
    tiersQueried: z.array(memoryTierSchema),
  }),
});

export type ContextBuildResponse = z.infer<typeof contextBuildResponseSchema>;
