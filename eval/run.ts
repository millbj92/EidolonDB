import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createBaselineAgent,
  createRagBaselineAgent,
  createEidolonDbAgent,
  cleanupEvalTenantMemories,
  type EvalAgent,
  type RuntimeConfig,
  type LlmMessage,
} from "./agents.js";
import {
  SCENARIOS,
  type AggregateMetrics,
  type EvalResult,
  type MultiScenarioEvalResult,
  type ScenarioDefinition,
  type SessionResult,
  type TranscriptMessage,
} from "./scenario.js";
import { computeAgentMetrics, scoreRecall } from "./scorer.js";

const RESULTS_DIR = path.resolve("eval/results");
const HISTORY_FILE = path.join(RESULTS_DIR, "history.jsonl");

function isoDateUtc(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function buildRuntimeConfig(): RuntimeConfig {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (typeof openAiApiKey !== "string" || openAiApiKey.trim().length === 0) {
    throw new Error("OPENAI_API_KEY is required");
  }

  return {
    openAiApiKey,
    eidolonDbUrl: process.env.EIDOLONDB_URL ?? "http://localhost:3000",
    model: "gpt-4o-mini",
  };
}

function getAssistantMessageFallback(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `I hit an internal error while responding: ${message}`;
}

function compactEvalResult(result: EvalResult): EvalResult {
  const compactSessions = (sessions: SessionResult[]): SessionResult[] =>
    sessions.map((session) => ({
      sessionNumber: session.sessionNumber,
      messages: [],
      recallScores: session.recallScores,
    }));

  return {
    ...result,
    baseline: {
      ...result.baseline,
      sessions: compactSessions(result.baseline.sessions),
    },
    rag_baseline: {
      ...result.rag_baseline,
      sessions: compactSessions(result.rag_baseline.sessions),
    },
    eidolondb: {
      ...result.eidolondb,
      sessions: compactSessions(result.eidolondb.sessions),
    },
  };
}

function compactMultiScenarioEvalResult(result: MultiScenarioEvalResult): MultiScenarioEvalResult {
  return {
    ...result,
    scenarios: result.scenarios.map((scenario) => compactEvalResult(scenario)),
  };
}

async function runAgentScenario(
  scenario: ScenarioDefinition,
  agent: EvalAgent,
  errors: string[]
): Promise<SessionResult[]> {
  const sessions: SessionResult[] = [];

  for (const session of scenario.sessions) {
    console.log(`[${scenario.name}] [${agent.agentType}] Session ${session.sessionNumber} start`);

    const sessionMessages: TranscriptMessage[] = [];
    const recallScores: SessionResult["recallScores"] = [];
    let llmMessages: LlmMessage[] = [];

    try {
      llmMessages = await agent.buildSessionSystemMessages(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const tag = `[${scenario.name}] [${agent.agentType}] session ${session.sessionNumber} memory injection failed: ${message}`;
      errors.push(tag);
      console.error(tag);
      llmMessages = [];
    }

    for (const userStep of session.userMessages) {
      const userMessage: TranscriptMessage = { role: "user", content: userStep.content };
      sessionMessages.push(userMessage);
      llmMessages.push({ role: "user", content: userStep.content });

      let assistantText = "";
      try {
        const enrichedMessages = agent.enrichMessages ? await agent.enrichMessages(llmMessages) : llmMessages;
        assistantText = await agent.respond(enrichedMessages);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const tag = `[${scenario.name}] [${agent.agentType}] session ${session.sessionNumber} turn failed: ${message}`;
        errors.push(tag);
        console.error(tag);
        assistantText = getAssistantMessageFallback(error);
      }

      const assistantMessage: TranscriptMessage = { role: "assistant", content: assistantText };
      sessionMessages.push(assistantMessage);
      llmMessages.push({ role: "assistant", content: assistantText });

      if (userStep.recallQuestionId) {
        const question = scenario.questions[userStep.recallQuestionId];
        if (question === undefined) {
          const tag = `[${scenario.name}] [${agent.agentType}] missing question definition for ${userStep.recallQuestionId}`;
          errors.push(tag);
          continue;
        }

        const score = scoreRecall(assistantText, question.requiredKeywords);
        recallScores.push({
          questionId: question.id,
          question: question.question,
          score,
          answer: assistantText,
        });
      }
    }

    try {
      await agent.persistSession(session, sessionMessages, scenario);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const tag = `[${scenario.name}] [${agent.agentType}] session ${session.sessionNumber} persist failed: ${message}`;
      errors.push(tag);
      console.error(tag);
    }

    sessions.push({
      sessionNumber: session.sessionNumber,
      messages: sessionMessages,
      recallScores,
    });

    console.log(`[${scenario.name}] [${agent.agentType}] Session ${session.sessionNumber} complete`);
  }

  return sessions;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeAggregateMetrics(results: EvalResult[]): AggregateMetrics {
  const baseline = {
    recallAccuracy: average(results.map((result) => result.baseline.recallAccuracy)),
    hallucinationScore: average(results.map((result) => result.baseline.hallucinationScore)),
    overallScore: average(results.map((result) => result.baseline.overallScore)),
  };

  const eidolondb = {
    recallAccuracy: average(results.map((result) => result.eidolondb.recallAccuracy)),
    hallucinationScore: average(results.map((result) => result.eidolondb.hallucinationScore)),
    overallScore: average(results.map((result) => result.eidolondb.overallScore)),
  };
  const rag_baseline = {
    recallAccuracy: average(results.map((result) => result.rag_baseline.recallAccuracy)),
    hallucinationScore: average(results.map((result) => result.rag_baseline.hallucinationScore)),
    overallScore: average(results.map((result) => result.rag_baseline.overallScore)),
  };

  return {
    baseline,
    rag_baseline,
    eidolondb,
    delta: {
      recallAccuracy: eidolondb.recallAccuracy - baseline.recallAccuracy,
      hallucinationScore: eidolondb.hallucinationScore - baseline.hallucinationScore,
      overallScore: eidolondb.overallScore - baseline.overallScore,
    },
  };
}

async function writeResults(result: MultiScenarioEvalResult): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });

  const resultPath = path.join(RESULTS_DIR, `${result.runDate}.json`);
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  const compact = compactMultiScenarioEvalResult(result);
  await appendFile(HISTORY_FILE, `${JSON.stringify(compact)}\n`, "utf8");

  console.log(`Saved full result: ${resultPath}`);
  console.log(`Appended history: ${HISTORY_FILE}`);
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const runDate = isoDateUtc();
  const runId = randomUUID();
  const errors: string[] = [];

  const config = buildRuntimeConfig();

  console.log(`Starting eval run ${runId} on ${runDate}`);
  console.log(`Scenarios: ${SCENARIOS.map((scenario) => scenario.name).join(", ")}`);
  console.log(`EIDOLONDB_URL: ${config.eidolonDbUrl}`);

  const scenarioResults: EvalResult[] = [];

  for (const scenario of SCENARIOS) {
    const scenarioStartedAt = Date.now();
    const scenarioErrors: string[] = [];

    console.log(`Starting scenario: ${scenario.name}`);

    try {
      const deleted = await cleanupEvalTenantMemories(config);
      console.log(`[${scenario.name}] Cleared eval tenant memories: ${deleted}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const tag = `[${scenario.name}] [cleanup] failed: ${message}`;
      scenarioErrors.push(tag);
      console.error(tag);
    }

    const baselineAgent = createBaselineAgent(config);
    const ragBaselineAgent = createRagBaselineAgent(config);
    const eidolonAgent = createEidolonDbAgent(config);

    const baselineSessions = await runAgentScenario(scenario, baselineAgent, scenarioErrors);
    const ragBaselineSessions = await runAgentScenario(scenario, ragBaselineAgent, scenarioErrors);
    const eidolonSessions = await runAgentScenario(scenario, eidolonAgent, scenarioErrors);

    for (const scenarioError of scenarioErrors) {
      errors.push(scenarioError);
    }

    const baseline = computeAgentMetrics("baseline", baselineSessions, scenario);
    const rag_baseline = computeAgentMetrics("rag_baseline", ragBaselineSessions, scenario);
    const eidolondb = computeAgentMetrics("eidolondb", eidolonSessions, scenario);

    const scenarioResult: EvalResult = {
      runDate,
      runId,
      scenario: scenario.name,
      baseline,
      rag_baseline,
      eidolondb,
      delta: {
        recallAccuracy: eidolondb.recallAccuracy - baseline.recallAccuracy,
        hallucinationScore: eidolondb.hallucinationScore - baseline.hallucinationScore,
        overallScore: eidolondb.overallScore - baseline.overallScore,
      },
      durationMs: Date.now() - scenarioStartedAt,
      errors: scenarioErrors,
    };

    scenarioResults.push(scenarioResult);

    console.log(
      `[${scenario.name}] Summary baseline(overall=${baseline.overallScore.toFixed(3)}) rag_baseline(overall=${rag_baseline.overallScore.toFixed(3)}) eidolondb(overall=${eidolondb.overallScore.toFixed(3)}) delta=${scenarioResult.delta.overallScore.toFixed(3)}`
    );
  }

  const aggregate = computeAggregateMetrics(scenarioResults);

  const result: MultiScenarioEvalResult = {
    runDate,
    runId,
    scenarios: scenarioResults,
    aggregate,
    overallDelta: aggregate.delta,
    durationMs: Date.now() - startedAt,
    errors,
  };

  await writeResults(result);

  console.log("Eval complete");
  console.log(
    JSON.stringify(
      {
        runId: result.runId,
        scenarios: result.scenarios.map((scenario) => ({
          scenario: scenario.scenario,
          baseline: {
            recallAccuracy: scenario.baseline.recallAccuracy,
            hallucinationScore: scenario.baseline.hallucinationScore,
            overallScore: scenario.baseline.overallScore,
          },
          rag_baseline: {
            recallAccuracy: scenario.rag_baseline.recallAccuracy,
            hallucinationScore: scenario.rag_baseline.hallucinationScore,
            overallScore: scenario.rag_baseline.overallScore,
          },
          eidolondb: {
            recallAccuracy: scenario.eidolondb.recallAccuracy,
            hallucinationScore: scenario.eidolondb.hallucinationScore,
            overallScore: scenario.eidolondb.overallScore,
          },
          delta: scenario.delta,
        })),
        aggregate: result.aggregate,
        overallDelta: result.overallDelta,
        durationMs: result.durationMs,
        errors: result.errors.length,
      },
      null,
      2
    )
  );
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Eval runner failed: ${message}`);

  try {
    await mkdir(RESULTS_DIR, { recursive: true });
    const panicPath = path.join(RESULTS_DIR, `${isoDateUtc()}-failed.log`);
    const existing = await readFile(panicPath, "utf8").catch(() => "");
    await writeFile(
      panicPath,
      `${existing}${new Date().toISOString()} :: ${message}\n`,
      "utf8"
    );
  } catch {
    // Ignore secondary write failures in panic path.
  }

  process.exitCode = 1;
});
