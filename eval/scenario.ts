export type AgentType = "baseline" | "eidolondb";

export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RecallScoreResult {
  question: string;
  score: number;
  answer: string;
}

export interface SessionResult {
  sessionNumber: number;
  messages: TranscriptMessage[];
  recallScores: RecallScoreResult[];
}

export interface AgentMetrics {
  agentType: AgentType;
  sessions: SessionResult[];
  totalRecallScore: number;
  maxRecallScore: number;
  recallAccuracy: number;
  hallucinationScore: number;
  onboardingTurns: number;
  overallScore: number;
}

export interface EvalResult {
  runDate: string;
  runId: string;
  scenario: string;
  baseline: AgentMetrics;
  eidolondb: AgentMetrics;
  delta: {
    recallAccuracy: number;
    hallucinationScore: number;
    overallScore: number;
  };
  durationMs: number;
  errors: string[];
}

export interface RecallQuestionDefinition {
  id: string;
  question: string;
  requiredKeywords: string[][];
  kind: "recall" | "hallucination";
}

export interface SessionUserStep {
  content: string;
  recallQuestionId?: string;
}

export interface SessionDefinition {
  sessionNumber: number;
  userMessages: SessionUserStep[];
}

export interface ScenarioDefinition {
  name: string;
  sessions: SessionDefinition[];
  questions: Record<string, RecallQuestionDefinition>;
}

export const PROJECT_ASSISTANT_V1: ScenarioDefinition = {
  name: "project-assistant-v1",
  questions: {
    s2_q1_stack: {
      id: "s2_q1_stack",
      question: "Hey, continuing the Nexus project. What stack are we using?",
      requiredKeywords: [["fastify"], ["typescript"], ["postgresql", "postgres"]],
      kind: "recall",
    },
    s2_q2_port: {
      id: "s2_q2_port",
      question: "What port did we decide on?",
      requiredKeywords: [["4000"]],
      kind: "recall",
    },
    s2_q3_developer: {
      id: "s2_q3_developer",
      question: "Who's the primary developer and what's their column naming preference?",
      requiredKeywords: [["jordan"], ["snake_case", "snake case"]],
      kind: "recall",
    },
    s3_q1_cache: {
      id: "s3_q1_cache",
      question: "Back again. What caching solution did we add last time and what's the TTL?",
      requiredKeywords: [["redis"], ["5 minutes", "5 minute", "300 seconds", "300 second"]],
      kind: "recall",
    },
    s3_q2_project_port: {
      id: "s3_q2_project_port",
      question: "What's the project name and the dev server port?",
      requiredKeywords: [["nexus"], ["4000"]],
      kind: "recall",
    },
    s3_q4_hallucination: {
      id: "s3_q4_hallucination",
      question: "Did we discuss an auth bug previously?",
      requiredKeywords: [["no", "didn't", "did not", "never", "not discussed", "don\u2019t think", "do not think"]],
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "We're building a REST API called Nexus. It uses Fastify, TypeScript, and PostgreSQL. No auth for now." },
        { content: "The primary developer is Jordan. Jordan prefers snake_case for database columns." },
        { content: "We decided to use port 4000 for the dev server." },
        { content: "Good. Let's pick this up next time." },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        {
          content: "Hey, continuing the Nexus project. What stack are we using?",
          recallQuestionId: "s2_q1_stack",
        },
        {
          content: "What port did we decide on?",
          recallQuestionId: "s2_q2_port",
        },
        {
          content: "Who's the primary developer and what's their column naming preference?",
          recallQuestionId: "s2_q3_developer",
        },
        { content: "We added a new decision: use Redis for caching. Cache TTL is 5 minutes." },
        { content: "Great, we'll continue tomorrow." },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "Back again. What caching solution did we add last time and what's the TTL?",
          recallQuestionId: "s3_q1_cache",
        },
        {
          content: "What's the project name and the dev server port?",
          recallQuestionId: "s3_q2_project_port",
        },
        { content: "Jordan pushed a fix for the auth bug we discussed." },
        {
          content: "Did we discuss an auth bug previously?",
          recallQuestionId: "s3_q4_hallucination",
        },
      ],
    },
  ],
};
