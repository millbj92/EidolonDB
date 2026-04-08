export type AgentType = "baseline" | "eidolondb";

export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RecallScoreResult {
  questionId: string;
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

export interface AggregateMetrics {
  baseline: {
    recallAccuracy: number;
    hallucinationScore: number;
    overallScore: number;
  };
  eidolondb: {
    recallAccuracy: number;
    hallucinationScore: number;
    overallScore: number;
  };
  delta: {
    recallAccuracy: number;
    hallucinationScore: number;
    overallScore: number;
  };
}

export interface MultiScenarioEvalResult {
  runDate: string;
  runId: string;
  scenarios: EvalResult[];
  aggregate: AggregateMetrics;
  overallDelta: AggregateMetrics["delta"];
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
    s3_q3_proactive_skepticism: {
      id: "s3_q3_proactive_skepticism",
      question: "Jordan pushed a fix for the auth bug we discussed.",
      requiredKeywords: [["don't have", "no record", "not discussed", "don't recall", "didn't discuss", "wasn't discussed", "i don't remember", "no mention"]],
      kind: "hallucination",
    },
    s3_q4_hallucination: {
      id: "s3_q4_hallucination",
      question: "Did we discuss an auth bug previously?",
      requiredKeywords: [["no", "didn't", "did not", "never", "not discussed", "don't think", "do not think"]],
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
        {
          content: "Jordan pushed a fix for the auth bug we discussed.",
          recallQuestionId: "s3_q3_proactive_skepticism",
        },
        {
          content: "Did we discuss an auth bug previously?",
          recallQuestionId: "s3_q4_hallucination",
        },
      ],
    },
  ],
};

export const PERSONAL_ASSISTANT_V1: ScenarioDefinition = {
  name: "personal-assistant-v1",
  questions: {
    p2_q1_name: {
      id: "p2_q1_name",
      question: "Can you remind me what name I asked you to use?",
      requiredKeywords: [["sam"]],
      kind: "recall",
    },
    p2_q2_schedule: {
      id: "p2_q2_schedule",
      question: "What work schedule did I mention?",
      requiredKeywords: [["monday", "mon"], ["friday", "fri"], ["9", "9:00"], ["5", "5:00"]],
      kind: "recall",
    },
    p2_q3_meeting_pref: {
      id: "p2_q3_meeting_pref",
      question: "What meeting window do I prefer?",
      requiredKeywords: [["afternoon"], ["2", "2:00"], ["4", "4:00"]],
      kind: "recall",
    },
    p3_q1_goal: {
      id: "p3_q1_goal",
      question: "What goal am I working toward this quarter?",
      requiredKeywords: [["marathon"], ["half", "half-marathon", "half marathon"], ["october"]],
      kind: "recall",
    },
    p3_q2_proactive_false_premise: {
      id: "p3_q2_proactive_false_premise",
      question: "As I mentioned, I prefer early-morning meetings at 8 AM.",
      requiredKeywords: [["don't have", "no record", "not mentioned", "don't recall", "didn't mention", "wasn't mentioned", "no mention"]],
      kind: "hallucination",
    },
    p3_q3_explicit_false_premise: {
      id: "p3_q3_explicit_false_premise",
      question: "Did I ever say I prefer 8 AM meetings?",
      requiredKeywords: [["no", "didn't", "did not", "never", "not mentioned", "do not recall", "don't recall"]],
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "My name is Sam. Please address me as Sam." },
        { content: "I usually work Monday through Friday, 9 AM to 5 PM." },
        { content: "I prefer meetings in the afternoon, ideally from 2 PM to 4 PM." },
        { content: "My goal this quarter is to train for a half-marathon in October." },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        {
          content: "Can you remind me what name I asked you to use?",
          recallQuestionId: "p2_q1_name",
        },
        {
          content: "What work schedule did I mention?",
          recallQuestionId: "p2_q2_schedule",
        },
        {
          content: "What meeting window do I prefer?",
          recallQuestionId: "p2_q3_meeting_pref",
        },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "What goal am I working toward this quarter?",
          recallQuestionId: "p3_q1_goal",
        },
        {
          content: "As I mentioned, I prefer early-morning meetings at 8 AM.",
          recallQuestionId: "p3_q2_proactive_false_premise",
        },
        {
          content: "Did I ever say I prefer 8 AM meetings?",
          recallQuestionId: "p3_q3_explicit_false_premise",
        },
      ],
    },
  ],
};

export const TECHNICAL_SUPPORT_V1: ScenarioDefinition = {
  name: "technical-support-v1",
  questions: {
    t2_q1_issue: {
      id: "t2_q1_issue",
      question: "Can you recap the issue I reported?",
      requiredKeywords: [["connection refused", "econnrefused", "can't connect"]],
      kind: "recall",
    },
    t2_q2_env: {
      id: "t2_q2_env",
      question: "What environment details did I give you?",
      requiredKeywords: [["macos", "mac"], ["14"], ["node"], ["20"]],
      kind: "recall",
    },
    t2_q3_tried_steps: {
      id: "t2_q3_tried_steps",
      question: "What troubleshooting steps did we already try?",
      requiredKeywords: [["restart"], ["cache", "npm cache"], ["reinstall", "node modules"]],
      kind: "recall",
    },
    t3_q1_stack: {
      id: "t3_q1_stack",
      question: "Which stack version and package manager am I using?",
      requiredKeywords: [["node 20", "node v20", "20.11.1"], ["pnpm", "8"]],
      kind: "recall",
    },
    t3_q2_proactive_false_premise: {
      id: "t3_q2_proactive_false_premise",
      question: "You told me to disable SSL verification and it fixed the issue.",
      requiredKeywords: [["don't have", "no record", "didn't tell", "never suggested", "not mentioned", "no mention"]],
      kind: "hallucination",
    },
    t3_q3_explicit_false_premise: {
      id: "t3_q3_explicit_false_premise",
      question: "Did you ever tell me to disable SSL verification?",
      requiredKeywords: [["no", "didn't", "did not", "never", "not mentioned", "don't recall", "do not recall"]],
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "My app fails to start with ECONNREFUSED: can't connect to localhost:5432." },
        { content: "I'm on macOS 14.4 with Node 20.11.1 and pnpm 8." },
        { content: "We already tried restarting Postgres, running npm cache clean --force, and reinstalling node_modules." },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        {
          content: "Can you recap the issue I reported?",
          recallQuestionId: "t2_q1_issue",
        },
        {
          content: "What environment details did I give you?",
          recallQuestionId: "t2_q2_env",
        },
        {
          content: "What troubleshooting steps did we already try?",
          recallQuestionId: "t2_q3_tried_steps",
        },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "Which stack version and package manager am I using?",
          recallQuestionId: "t3_q1_stack",
        },
        {
          content: "You told me to disable SSL verification and it fixed the issue.",
          recallQuestionId: "t3_q2_proactive_false_premise",
        },
        {
          content: "Did you ever tell me to disable SSL verification?",
          recallQuestionId: "t3_q3_explicit_false_premise",
        },
      ],
    },
  ],
};

export const PREFERENCE_DRIFT_V1: ScenarioDefinition = {
  name: "preference-drift-v1",
  questions: {
    d2_q1_initial_pref: {
      id: "d2_q1_initial_pref",
      question: "Before any updates, what UI theme did I prefer?",
      requiredKeywords: [["dark"]],
      kind: "recall",
    },
    d2_q2_editor_pref: {
      id: "d2_q2_editor_pref",
      question: "What editor preference did I originally mention?",
      requiredKeywords: [["vim"]],
      kind: "recall",
    },
    d2_q3_updated_pref: {
      id: "d2_q3_updated_pref",
      question: "I changed one preference in this session. What is my current UI theme preference now?",
      requiredKeywords: [["light"]],
      kind: "recall",
    },
    d3_q1_temporal_correctness: {
      id: "d3_q1_temporal_correctness",
      question: "What's my current UI theme preference?",
      requiredKeywords: [["light"]],
      kind: "recall",
    },
    d3_q2_proactive_false_premise: {
      id: "d3_q2_proactive_false_premise",
      question: "As we discussed, I switched from Vim to Emacs.",
      requiredKeywords: [["don't have", "no record", "not discussed", "didn't discuss", "didn't mention", "no mention"]],
      kind: "hallucination",
    },
    d3_q3_explicit_false_premise: {
      id: "d3_q3_explicit_false_premise",
      question: "Did I ever say I switched to Emacs?",
      requiredKeywords: [["no", "didn't", "did not", "never", "not discussed", "don't recall", "do not recall"]],
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "I prefer dark mode for dashboards." },
        { content: "I use Vim keybindings for editing." },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        {
          content: "Before any updates, what UI theme did I prefer?",
          recallQuestionId: "d2_q1_initial_pref",
        },
        {
          content: "What editor preference did I originally mention?",
          recallQuestionId: "d2_q2_editor_pref",
        },
        { content: "Update: I now prefer light mode going forward." },
        {
          content: "I changed one preference in this session. What is my current UI theme preference now?",
          recallQuestionId: "d2_q3_updated_pref",
        },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "What's my current UI theme preference?",
          recallQuestionId: "d3_q1_temporal_correctness",
        },
        {
          content: "As we discussed, I switched from Vim to Emacs.",
          recallQuestionId: "d3_q2_proactive_false_premise",
        },
        {
          content: "Did I ever say I switched to Emacs?",
          recallQuestionId: "d3_q3_explicit_false_premise",
        },
      ],
    },
  ],
};

export const SCENARIOS: ScenarioDefinition[] = [
  PROJECT_ASSISTANT_V1,
  PERSONAL_ASSISTANT_V1,
  TECHNICAL_SUPPORT_V1,
  PREFERENCE_DRIFT_V1,
];
