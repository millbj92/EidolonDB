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

function calculateOnboardingTurns(sessions: SessionResult[]): number {
  const session2 = sessions.find((s) => s.sessionNumber === 2);
  if (session2 === undefined) {
    return 1;
  }

  const firstRecall = session2.recallScores.find((item) =>
    item.question.includes("What stack are we using")
  );

  if (firstRecall === undefined) {
    return 1;
  }

  const lower = firstRecall.answer.toLowerCase();
  const asksForContext =
    lower.includes("remind") ||
    lower.includes("context") ||
    lower.includes("don't have") ||
    lower.includes("do not have") ||
    lower.includes("can't") ||
    lower.includes("cannot");

  return firstRecall.score >= 1 && asksForContext === false ? 0 : 1;
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
  const recallAccuracy = maxRecallScore > 0 ? totalRecallScore / maxRecallScore : 0;
  const onboardingTurns = calculateOnboardingTurns(sessions);
  const onboardingBonus = onboardingTurns === 0 ? 1 : 0;
  const overallScore =
    clamp01(recallAccuracy) * 0.6 +
    clamp01(hallucinationScore) * 0.3 +
    clamp01(onboardingBonus) * 0.1;

  return {
    agentType,
    sessions,
    totalRecallScore,
    maxRecallScore,
    recallAccuracy,
    hallucinationScore,
    onboardingTurns,
    overallScore,
  };
}
