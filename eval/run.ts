import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createBaselineAgent,
  createRagBaselineAgent,
  createEidolonDbAgent,
  createEidolonDbRbacAgent,
  cleanupEvalTenantMemories,
  cleanupEvalTenantGrants,
  ensureRbacEvalEntities,
  type EvalAgent,
  type RuntimeConfig,
  type LlmMessage,
} from "./agents.js";
import {
  SCENARIOS,
  type AgentType,
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
type SuiteName = "all" | "core" | "rbac";

interface CliOptions {
  suite: SuiteName;
  scenario?: string;
  listOnly: boolean;
}

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

function parseCliArgs(argv: string[]): CliOptions {
  let suite: SuiteName = "all";
  let scenario: string | undefined;
  let listOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--list") {
      listOnly = true;
      continue;
    }

    if (arg === "--suite") {
      const value = argv[index + 1];
      if (value !== "all" && value !== "core" && value !== "rbac") {
        throw new Error(`Invalid --suite value: ${value ?? "<missing>"}. Expected one of: all, core, rbac`);
      }
      suite = value;
      index += 1;
      continue;
    }

    if (arg === "--scenario") {
      const value = argv[index + 1];
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error("--scenario requires a scenario name");
      }
      scenario = value.trim();
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    suite,
    scenario,
    listOnly,
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

function isRbacScenario(scenario: ScenarioDefinition): boolean {
  return scenario.name.startsWith("rbac-");
}

function selectScenarios(allScenarios: ScenarioDefinition[], options: CliOptions): ScenarioDefinition[] {
  if (options.scenario) {
    const matched = allScenarios.find((scenario) => scenario.name === options.scenario);
    if (!matched) {
      throw new Error(`Scenario not found: ${options.scenario}`);
    }
    return [matched];
  }

  if (options.suite === "core") {
    return allScenarios.filter((scenario) => !isRbacScenario(scenario));
  }

  if (options.suite === "rbac") {
    return allScenarios.filter((scenario) => isRbacScenario(scenario));
  }

  return allScenarios;
}

function zeroMetrics(agentType: AgentType): EvalResult["baseline"] {
  return {
    agentType,
    sessions: [],
    totalRecallScore: 0,
    maxRecallScore: 0,
    recallAccuracy: 0,
    hallucinationScore: 0,
    overallScore: 0,
  };
}

async function writeResults(result: MultiScenarioEvalResult, suffix?: string): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });

  const resultPath = path.join(
    RESULTS_DIR,
    suffix && suffix.length > 0 ? `${result.runDate}-${suffix}.json` : `${result.runDate}.json`
  );
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  const compact = compactMultiScenarioEvalResult(result);
  await appendFile(HISTORY_FILE, `${JSON.stringify(compact)}\n`, "utf8");

  console.log(`Saved full result: ${resultPath}`);
  console.log(`Appended history: ${HISTORY_FILE}`);
}

async function main(): Promise<void> {
  const cliOptions = parseCliArgs(process.argv.slice(2));
  const selectedScenarios = selectScenarios(SCENARIOS, cliOptions);

  if (cliOptions.listOnly) {
    console.log("Available scenarios:");
    for (const scenario of SCENARIOS) {
      const suite = isRbacScenario(scenario) ? "rbac" : "core";
      console.log(`- ${scenario.name} [${suite}]`);
    }
    return;
  }

  if (selectedScenarios.length === 0) {
    throw new Error("No scenarios selected");
  }

  const startedAt = Date.now();
  const runDate = isoDateUtc();
  const runId = randomUUID();
  const errors: string[] = [];

  const config = buildRuntimeConfig();
  const filterLabel = cliOptions.scenario ? `scenario ${cliOptions.scenario}` : `suite ${cliOptions.suite}`;

  console.log(`Starting eval run ${runId} on ${runDate}`);
  if (cliOptions.scenario) {
    console.log(`Scenario: ${cliOptions.scenario} (${selectedScenarios.length} scenario)`);
  } else {
    console.log(`Suite: ${cliOptions.suite} (${selectedScenarios.length} scenarios)`);
  }
  console.log(`Scenarios: ${selectedScenarios.map((scenario) => scenario.name).join(", ")}`);
  console.log(`EIDOLONDB_URL: ${config.eidolonDbUrl}`);

  const scenarioResults: EvalResult[] = [];

  for (const scenario of selectedScenarios) {
    const scenarioStartedAt = Date.now();
    const scenarioErrors: string[] = [];
    const rbacScenario = isRbacScenario(scenario);

    console.log(`Starting scenario: ${scenario.name}${rbacScenario ? " [RBAC]" : ""}`);

    try {
      const deleted = await cleanupEvalTenantMemories(config);
      console.log(`[${scenario.name}] Cleared eval tenant memories: ${deleted}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const tag = `[${scenario.name}] [cleanup] failed: ${message}`;
      scenarioErrors.push(tag);
      console.error(tag);
    }

    try {
      const deletedGrants = await cleanupEvalTenantGrants(config);
      console.log(`[${scenario.name}] Cleared eval tenant grants: ${deletedGrants}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const tag = `[${scenario.name}] [cleanup] grants failed: ${message}`;
      scenarioErrors.push(tag);
      console.error(tag);
    }

    let baselineSessions: SessionResult[] = [];
    let ragBaselineSessions: SessionResult[] = [];
    let eidolonSessions: SessionResult[] = [];
    let baseline = zeroMetrics("baseline");
    let rag_baseline = zeroMetrics("rag_baseline");
    let eidolondb = zeroMetrics("eidolondb");

    if (rbacScenario) {
      try {
        await ensureRbacEvalEntities(config);
        console.log(`[${scenario.name}] RBAC entities upserted`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const tag = `[${scenario.name}] [setup] RBAC entities failed: ${message}`;
        scenarioErrors.push(tag);
        console.error(tag);
      }

      const rbacAgentA = createEidolonDbRbacAgent(config, "a");
      const rbacAgentB = createEidolonDbRbacAgent(config, "b");
      const setupSessionIndex = scenario.sessions.findIndex((session) =>
        session.userMessages.some((message) => message.content.trim().startsWith("[SETUP]"))
      );
      const splitIndex = setupSessionIndex === -1 ? 1 : setupSessionIndex + 1;

      const aScenario: ScenarioDefinition = {
        ...scenario,
        sessions: scenario.sessions.slice(0, splitIndex),
      };
      const bScenario: ScenarioDefinition = {
        ...scenario,
        sessions: scenario.sessions.slice(splitIndex),
      };

      const aSessions = await runAgentScenario(aScenario, rbacAgentA, scenarioErrors);
      const bSessions = await runAgentScenario(bScenario, rbacAgentB, scenarioErrors);
      eidolonSessions = [...aSessions, ...bSessions];
      eidolondb = computeAgentMetrics("eidolondb_rbac", eidolonSessions, scenario);

      const note =
        `[${scenario.name}] [note] RBAC scenario executed with eidolondb_rbac only; ` +
        "baseline and rag_baseline metrics are placeholders set to 0.";
      scenarioErrors.push(note);
      console.log(note);
    } else {
      const baselineAgent = createBaselineAgent(config);
      const ragBaselineAgent = createRagBaselineAgent(config);
      const eidolonAgent = createEidolonDbAgent(config);

      baselineSessions = await runAgentScenario(scenario, baselineAgent, scenarioErrors);
      ragBaselineSessions = await runAgentScenario(scenario, ragBaselineAgent, scenarioErrors);
      eidolonSessions = await runAgentScenario(scenario, eidolonAgent, scenarioErrors);
      baseline = computeAgentMetrics("baseline", baselineSessions, scenario);
      rag_baseline = computeAgentMetrics("rag_baseline", ragBaselineSessions, scenario);
      eidolondb = computeAgentMetrics("eidolondb", eidolonSessions, scenario);
    }

    for (const scenarioError of scenarioErrors) {
      errors.push(scenarioError);
    }

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
      `[${scenario.name}] Summary baseline(overall=${baseline.overallScore.toFixed(3)}) rag_baseline(overall=${rag_baseline.overallScore.toFixed(3)}) ${rbacScenario ? "eidolondb_rbac" : "eidolondb"}(overall=${eidolondb.overallScore.toFixed(3)}) delta=${scenarioResult.delta.overallScore.toFixed(3)}`
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

  const outputSuffix =
    cliOptions.scenario && cliOptions.scenario.length > 0
      ? `scenario-${cliOptions.scenario}`
      : cliOptions.suite === "all"
        ? undefined
        : cliOptions.suite;
  await writeResults(result, outputSuffix);

  console.log("Eval complete");
  console.log(`Filter: ${filterLabel}`);
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
