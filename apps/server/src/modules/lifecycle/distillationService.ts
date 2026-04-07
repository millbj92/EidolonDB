import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { env } from '../../common/config/index.js';

export const DISTILLATION_VERSION = 'v1';
export const DISTILLATION_PROMPT_VERSION = 'distill-v1';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DISTILLATION_MODEL = 'gpt-4o-mini';

const distillationOutputSchema = z.object({
  distilledContent: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});

interface OpenAIChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

function buildSystemPrompt(): string {
  return [
    'You distill episodic memories into durable semantic facts for an AI memory store.',
    'Extract only the core durable knowledge from the episodic input.',
    'Remove session-specific framing such as dates, "today", "in this session", and first-person process notes.',
    'Produce a concise, standalone factual statement.',
    'If there is no meaningful distillable semantic value, set confidence below 0.5.',
    'Return ONLY valid JSON with this exact shape:',
    '{"distilledContent":"string","confidence":0.0,"rationale":"string"}',
    'No markdown. No prose outside JSON.',
  ].join('\n');
}

function parseDistillationResponse(responseText: string, logger?: FastifyBaseLogger) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    logger?.error({ rawResponse: responseText, error }, 'Distillation returned malformed JSON');
    throw new Error('Distillation returned malformed JSON');
  }

  const validated = distillationOutputSchema.safeParse(parsed);
  if (!validated.success) {
    logger?.error(
      {
        rawResponse: responseText,
        issues: validated.error.issues,
      },
      'Distillation output failed schema validation'
    );
    throw new Error('Distillation output failed schema validation');
  }

  return validated.data;
}

export async function distillEpisodicMemory(
  content: string,
  logger?: FastifyBaseLogger
): Promise<{ distilledContent: string; confidence: number; rationale: string } | null> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('LLM distillation requires OPENAI_API_KEY');
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: DISTILLATION_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(),
        },
        {
          role: 'user',
          content,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger?.error(
      {
        status: response.status,
        body: errorBody,
      },
      'OpenAI distillation request failed'
    );
    throw new Error(`OpenAI distillation failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenAIChatCompletionsResponse;
  const responseContent = data.choices?.[0]?.message?.content;
  if (!responseContent) {
    logger?.error({ response: data }, 'OpenAI distillation returned empty content');
    throw new Error('OpenAI distillation returned empty content');
  }

  const distillationOutput = parseDistillationResponse(responseContent, logger);
  if (distillationOutput.confidence < 0.5) {
    return null;
  }

  return distillationOutput;
}
