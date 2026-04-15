import type { AgentMetrics, AgentType, ScenarioDefinition, SessionResult } from "./scenario.js";

export function scoreRecall(answer: string, requiredKeywords: string[][]): number {
  const lower = answer.toLowerCase();
  const groupScores = requiredKeywords.map((group) =>
    group.some((kw) => lower.includes(kw.toLowerCase())) ? 1 : 0
  );
  return groupScores.reduce((a, b) => a + b, 0) / groupScores.length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeAgentMetrics(
  agentType: AgentType,
  sessions: SessionResult[],
  scenario: ScenarioDefinition
): AgentMetrics {
  const hallucinationQuestionIds = new Set(
    Object.values(scenario.questions)
      .filter((question) => question.kind === "hallucination")
      .map((question) => question.id)
  );

  let totalRecallScore = 0;
  let maxRecallScore = 0;
  let hallucinationHitCount = 0;
  let hallucinationQuestionCount = 0;

  for (const session of sessions) {
    for (const recall of session.recallScores) {
      if (hallucinationQuestionIds.has(recall.questionId)) {
        hallucinationQuestionCount += 1;
        hallucinationHitCount += recall.score >= 1 ? 1 : 0;
      } else {
        totalRecallScore += recall.score;
        maxRecallScore += 1;
      }
    }
  }

  const hallucinationScore =
    hallucinationQuestionCount > 0 ? hallucinationHitCount / hallucinationQuestionCount : 0;
  // If no recall questions exist, don't penalize recall — use hallucination score only
  // If no hallucination questions exist, don't penalize hallucination — use recall score only
  const recallAccuracy = maxRecallScore > 0 ? totalRecallScore / maxRecallScore : 1;
  const overallScore = maxRecallScore === 0
    ? clamp01(hallucinationScore)
    : hallucinationQuestionCount === 0
      ? clamp01(recallAccuracy)
      : clamp01(recallAccuracy) * 0.7 + clamp01(hallucinationScore) * 0.3;

  return {
    agentType,
    sessions,
    totalRecallScore,
    maxRecallScore,
    recallAccuracy,
    hallucinationScore,
    overallScore,
  };
}
