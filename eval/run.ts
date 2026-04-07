import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createBaselineAgent, createEidolonDbAgent, cleanupEvalTenantMemories, type EvalAgent, type RuntimeConfig, type LlmMessage } from "./agents.js";
import { PROJECT_ASSISTANT_V1, type EvalResult, type SessionResult, type TranscriptMessage } from "./scenario.js";
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
    eidolondb: {
      ...result.eidolondb,
      sessions: compactSessions(result.eidolondb.sessions),
    },
  };
}

async function runAgentScenario(agent: EvalAgent, errors: string[]): Promise<SessionResult[]> {
  const sessions: SessionResult[] = [];

  for (const session of PROJECT_ASSISTANT_V1.sessions) {
    console.log(`[${agent.agentType}] Session ${session.sessionNumber} start`);

    const sessionMessages: TranscriptMessage[] = [];
    const recallScores: SessionResult["recallScores"] = [];
    let llmMessages: LlmMessage[] = [];

    try {
      llmMessages = await agent.buildSessionSystemMessages(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const tag = `[${agent.agentType}] session ${session.sessionNumber} memory injection failed: ${message}`;
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
        assistantText = await agent.respond(llmMessages);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const tag = `[${agent.agentType}] session ${session.sessionNumber} turn failed: ${message}`;
        errors.push(tag);
        console.error(tag);
        assistantText = getAssistantMessageFallback(error);
      }

      const assistantMessage: TranscriptMessage = { role: "assistant", content: assistantText };
      sessionMessages.push(assistantMessage);
      llmMessages.push({ role: "assistant", content: assistantText });

      if (userStep.recallQuestionId) {
        const question = PROJECT_ASSISTANT_V1.questions[userStep.recallQuestionId];
        if (question === undefined) {
          const tag = `[${agent.agentType}] missing question definition for ${userStep.recallQuestionId}`;
          errors.push(tag);
          continue;
        }

        const score = scoreRecall(assistantText, question.requiredKeywords);
        recallScores.push({
          question: question.question,
          score,
          answer: assistantText,
        });
      }
    }

    try {
      await agent.persistSession(session, sessionMessages);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const tag = `[${agent.agentType}] session ${session.sessionNumber} persist failed: ${message}`;
      errors.push(tag);
      console.error(tag);
    }

    sessions.push({
      sessionNumber: session.sessionNumber,
      messages: sessionMessages,
      recallScores,
    });

    console.log(`[${agent.agentType}] Session ${session.sessionNumber} complete`);
  }

  return sessions;
}

async function writeResults(result: EvalResult): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });

  const resultPath = path.join(RESULTS_DIR, `${result.runDate}.json`);
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  const compact = compactEvalResult(result);
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
  console.log(`Scenario: ${PROJECT_ASSISTANT_V1.name}`);
  console.log(`EIDOLONDB_URL: ${config.eidolonDbUrl}`);

  try {
    const deleted = await cleanupEvalTenantMemories(config);
    console.log(`Cleared eval tenant memories: ${deleted}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const tag = `[cleanup] failed: ${message}`;
    errors.push(tag);
    console.error(tag);
  }

  const baselineAgent = createBaselineAgent(config);
  const eidolonAgent = createEidolonDbAgent(config);

  const baselineSessions = await runAgentScenario(baselineAgent, errors);
  const eidolonSessions = await runAgentScenario(eidolonAgent, errors);

  const baseline = computeAgentMetrics("baseline", baselineSessions, PROJECT_ASSISTANT_V1);
  const eidolondb = computeAgentMetrics("eidolondb", eidolonSessions, PROJECT_ASSISTANT_V1);

  const durationMs = Date.now() - startedAt;

  const result: EvalResult = {
    runDate,
    runId,
    scenario: PROJECT_ASSISTANT_V1.name,
    baseline,
    eidolondb,
    delta: {
      recallAccuracy: eidolondb.recallAccuracy - baseline.recallAccuracy,
      hallucinationScore: eidolondb.hallucinationScore - baseline.hallucinationScore,
      overallScore: eidolondb.overallScore - baseline.overallScore,
    },
    durationMs,
    errors,
  };

  await writeResults(result);

  console.log("Eval complete");
  console.log(
    JSON.stringify(
      {
        runId: result.runId,
        baseline: {
          recallAccuracy: baseline.recallAccuracy,
          hallucinationScore: baseline.hallucinationScore,
          overallScore: baseline.overallScore,
        },
        eidolondb: {
          recallAccuracy: eidolondb.recallAccuracy,
          hallucinationScore: eidolondb.hallucinationScore,
          overallScore: eidolondb.overallScore,
        },
        delta: result.delta,
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
