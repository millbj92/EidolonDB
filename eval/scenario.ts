export type AgentType =
  | "baseline"
  | "rag_baseline"
  | "eidolondb"
  | "eidolondb_rbac"
  | "eidolondb_conflict";

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
  overallScore: number;
}

export interface EvalResult {
  runDate: string;
  runId: string;
  scenario: string;
  baseline: AgentMetrics;
  rag_baseline: AgentMetrics;
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
  rag_baseline: {
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

const HALLUCINATION_REQUIRED_KEYWORDS: string[][] = [
  [
    "no record",
    "not discussed",
    "don't recall",
    "didn't discuss",
    "wasn't discussed",
    "i have no",
    "i don't have any record",
    "no, you didn't mention",
    "you never mentioned",
    "that wasn't mentioned",
    "i don't see that",
    "i don't have that",
    "that doesn't match",
    "that contradicts",
    "you didn't say",
    "no, you didn't",
    "wasn't mentioned",
  ],
];

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
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
    s3_q4_hallucination: {
      id: "s3_q4_hallucination",
      question: "Did we discuss an auth bug previously?",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
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
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
    p3_q3_explicit_false_premise: {
      id: "p3_q3_explicit_false_premise",
      question: "Did I ever say I prefer 8 AM meetings?",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
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
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
    t3_q3_explicit_false_premise: {
      id: "t3_q3_explicit_false_premise",
      question: "Did you ever tell me to disable SSL verification?",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
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
      question: "What is my current UI theme preference?",
      requiredKeywords: [["light mode", "light"]],
      kind: "recall",
    },
    d3_q1_temporal_correctness: {
      id: "d3_q1_temporal_correctness",
      question: "What's my current UI theme preference?",
      requiredKeywords: [["light mode", "light"]],
      kind: "recall",
    },
    d3_q2_editor_pref: {
      id: "d3_q2_editor_pref",
      question: "What editor keybinding do I use?",
      requiredKeywords: [["vim"]],
      kind: "recall",
    },
    d3_q3_proactive_false_premise: {
      id: "d3_q3_proactive_false_premise",
      question: "As we discussed, I switched from Vim to Emacs.",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
    d3_q4_explicit_false_premise: {
      id: "d3_q4_explicit_false_premise",
      question: "Did I ever say I switched to Emacs?",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
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
        { content: "Update: I'm switching to light mode from now on. Please remember this." },
        {
          content: "What is my current UI theme preference?",
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
          content: "What editor keybinding do I use?",
          recallQuestionId: "d3_q2_editor_pref",
        },
        {
          content: "As we discussed, I switched from Vim to Emacs.",
          recallQuestionId: "d3_q3_proactive_false_premise",
        },
        {
          content: "Did I ever say I switched to Emacs?",
          recallQuestionId: "d3_q4_explicit_false_premise",
        },
      ],
    },
  ],
};

export const AMBIGUOUS_RECALL_V1: ScenarioDefinition = {
  name: "ambiguous-recall-v1",
  questions: {
    a2_q1_start_time: {
      id: "a2_q1_start_time",
      question: "What time does the team usually start work?",
      requiredKeywords: [["10", "mid-morning", "morning"], ["around", "approximately", "usually"]],
      kind: "recall",
    },
    a2_q2_storage: {
      id: "a2_q2_storage",
      question: "What storage approach are we using?",
      requiredKeywords: [["document", "nosql", "mongo"], ["oriented", "based", "approach"]],
      kind: "recall",
    },
    a2_q3_alex_pref: {
      id: "a2_q3_alex_pref",
      question: "What's Alex's coding preference?",
      requiredKeywords: [["camel", "variable", "naming"], ["style", "preference"]],
      kind: "recall",
    },
    a3_q1_false_claim: {
      id: "a3_q1_false_claim",
      question: "I mentioned we're using PostgreSQL.",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
    a3_q2_false_question: {
      id: "a3_q2_false_question",
      question: "Did I say PostgreSQL?",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "The team usually kicks things off around mid-morning." },
        { content: "We're leaning toward a document-oriented approach for storage." },
        {
          content:
            "The lead is Alex - they're pretty particular about code style, specifically around how variables are named.",
        },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        {
          content: "What time does the team usually start work?",
          recallQuestionId: "a2_q1_start_time",
        },
        {
          content: "What storage approach are we using?",
          recallQuestionId: "a2_q2_storage",
        },
        {
          content: "What's Alex's coding preference?",
          recallQuestionId: "a2_q3_alex_pref",
        },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "I mentioned we're using PostgreSQL.",
          recallQuestionId: "a3_q1_false_claim",
        },
        {
          content: "Did I say PostgreSQL?",
          recallQuestionId: "a3_q2_false_question",
        },
      ],
    },
  ],
};

export const CONTRADICTORY_MEMORY_V1: ScenarioDefinition = {
  name: "contradictory-memory-v1",
  questions: {
    c2_q1_port_now: {
      id: "c2_q1_port_now",
      question: "What port is the API on now?",
      requiredKeywords: [["3000"]],
      kind: "recall",
    },
    c2_q2_lang_now: {
      id: "c2_q2_lang_now",
      question: "What language are we using?",
      requiredKeywords: [["go", "golang"]],
      kind: "recall",
    },
    c2_q3_port_original: {
      id: "c2_q3_port_original",
      question: "What port did we originally plan?",
      requiredKeywords: [["8080", "original", "initially", "first"]],
      kind: "recall",
    },
    c2_q4_deploy_target: {
      id: "c2_q4_deploy_target",
      question: "What's the deploy target?",
      requiredKeywords: [["aws", "amazon"]],
      kind: "recall",
    },
    c3_q1_false_claim: {
      id: "c3_q1_false_claim",
      question: "As I mentioned, we're using Python.",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
    c3_q2_python_override: {
      id: "c3_q2_python_override",
      question: "Did we ever discuss Python?",
      requiredKeywords: [["python"], ["changed", "switched", "moved", "updated", "go", "golang"]],
      kind: "recall",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "The API will run on port 8080." },
        { content: "We're using Python for the backend." },
        { content: "The deploy target is AWS." },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        { content: "Actually, we changed the port to 3000." },
        { content: "We also moved to Go for the backend - Python was too slow." },
        {
          content: "What port is the API on now?",
          recallQuestionId: "c2_q1_port_now",
        },
        {
          content: "What language are we using?",
          recallQuestionId: "c2_q2_lang_now",
        },
        {
          content: "What port did we originally plan?",
          recallQuestionId: "c2_q3_port_original",
        },
        {
          content: "What's the deploy target?",
          recallQuestionId: "c2_q4_deploy_target",
        },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "As I mentioned, we're using Python.",
          recallQuestionId: "c3_q1_false_claim",
        },
        {
          content: "Did we ever discuss Python?",
          recallQuestionId: "c3_q2_python_override",
        },
      ],
    },
  ],
};

export const INCOMPLETE_RECALL_V1: ScenarioDefinition = {
  name: "incomplete-recall-v1",
  questions: {
    i2_q1_project_and_goal: {
      id: "i2_q1_project_and_goal",
      question: "What's the project called and what does it do?",
      requiredKeywords: [["atlas"], ["pipeline", "data"]],
      kind: "recall",
    },
    i2_q2_stack: {
      id: "i2_q2_stack",
      question: "What's the full tech stack?",
      requiredKeywords: [["python"], ["airflow"], ["dbt"], ["snowflake"]],
      kind: "recall",
    },
    i2_q3_team: {
      id: "i2_q3_team",
      question: "Who are the team members?",
      requiredKeywords: [["morgan"], ["riley"], ["casey"]],
      kind: "recall",
    },
    i2_q4_sla: {
      id: "i2_q4_sla",
      question: "What's the SLA?",
      requiredKeywords: [["2 hours", "two hours", "2-hour"], ["pipeline", "complete", "finish"]],
      kind: "recall",
    },
    i2_q5_phase: {
      id: "i2_q5_phase",
      question: "What phase are we in?",
      requiredKeywords: [["design"], ["no code", "not started", "planning"]],
      kind: "recall",
    },
    i3_q1_false_claim: {
      id: "i3_q1_false_claim",
      question: "As we discussed, we already have code in production.",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
    i3_q2_code_written: {
      id: "i3_q2_code_written",
      question: "Did we say any code has been written?",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "Project name is Atlas. We're building a data pipeline." },
        { content: "Stack: Python 3.12, Apache Airflow, dbt, Snowflake." },
        { content: "Team: Morgan (data engineer), Riley (analytics), Casey (lead)." },
        { content: "SLA: pipelines must complete within 2 hours of data landing." },
        { content: "We're in the design phase - no code written yet." },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        {
          content: "What's the project called and what does it do?",
          recallQuestionId: "i2_q1_project_and_goal",
        },
        {
          content: "What's the full tech stack?",
          recallQuestionId: "i2_q2_stack",
        },
        {
          content: "Who are the team members?",
          recallQuestionId: "i2_q3_team",
        },
        {
          content: "What's the SLA?",
          recallQuestionId: "i2_q4_sla",
        },
        {
          content: "What phase are we in?",
          recallQuestionId: "i2_q5_phase",
        },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "As we discussed, we already have code in production.",
          recallQuestionId: "i3_q1_false_claim",
        },
        {
          content: "Did we say any code has been written?",
          recallQuestionId: "i3_q2_code_written",
        },
      ],
    },
  ],
};

export const TEMPORAL_SESSION_V1: ScenarioDefinition = {
  name: "temporal-session-v1",
  questions: {
    ts3_q1_last_session: {
      id: "ts3_q1_last_session",
      question: "What did we do last session?",
      requiredKeywords: [["atlas"], ["go", "golang"], ["8080"], ["morgan"]],
      kind: "recall",
    },
    ts3_q2_false_premise: {
      id: "ts3_q2_false_premise",
      question: "As I mentioned last session, we're using Python.",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "Project Orion uses a Python backend." },
        { content: "Project Orion runs on port 5000." },
        { content: "Dana is the lead for Project Orion." },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        { content: "Project Atlas uses a Go backend." },
        { content: "Project Atlas runs on port 8080." },
        { content: "Morgan is the lead for Project Atlas." },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "What did we do last session?",
          recallQuestionId: "ts3_q1_last_session",
        },
        {
          content: "As I mentioned last session, we're using Python.",
          recallQuestionId: "ts3_q2_false_premise",
        },
      ],
    },
  ],
};

export const CONFLICT_DETECTION_V1: ScenarioDefinition = {
  name: "conflict-detection-v1",
  questions: {
    conflict_det_q1: {
      id: "conflict_det_q1",
      question: "Is there a conflict about the API port?",
      requiredKeywords: [
        [
          "conflict",
          "flagged",
          "contradiction",
          "both",
          "8080 and 3000",
          "3000 and 8080",
          "two different",
          "discrepancy",
        ],
      ],
      kind: "recall",
    },
    conflict_det_q2: {
      id: "conflict_det_q2",
      question: "What port does the API run on?",
      requiredKeywords: [["8080", "3000"]],
      kind: "recall",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "The API runs on port 8080" },
        { content: "The backend framework is Express" },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        {
          content:
            "[SETUP-CONFLICT] store contradiction: The API runs on port 3000\n[SETUP-CONFLICT] detect autoResolve=false",
        },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "Is there a conflict about the API port?",
          recallQuestionId: "conflict_det_q1",
        },
        {
          content: "What port does the API run on?",
          recallQuestionId: "conflict_det_q2",
        },
      ],
    },
  ],
};

export const CONFLICT_MERGE_V1: ScenarioDefinition = {
  name: "conflict-merge-v1",
  questions: {
    conflict_merge_q1: {
      id: "conflict_merge_q1",
      question: "Who leads the backend team?",
      requiredKeywords: [["jordan", "casey"]],
      kind: "recall",
    },
    conflict_merge_q2: {
      id: "conflict_merge_q2",
      question: "What backend technology do we use?",
      requiredKeywords: [["node", "nodejs", "node.js"]],
      kind: "recall",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "Jordan is the backend lead" },
        { content: "The backend uses Node.js" },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        {
          content:
            "[SETUP-CONFLICT] store contradiction: Casey is the backend lead\n[SETUP-CONFLICT] detect autoResolve=true strategy=merge",
        },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "Who leads the backend team?",
          recallQuestionId: "conflict_merge_q1",
        },
        {
          content: "What backend technology do we use?",
          recallQuestionId: "conflict_merge_q2",
        },
      ],
    },
  ],
};

export const CONFLICT_NEWER_WINS_V1: ScenarioDefinition = {
  name: "conflict-newer-wins-v1",
  questions: {
    conflict_new_q1: {
      id: "conflict_new_q1",
      question: "What database do we use?",
      requiredKeywords: [["postgresql", "postgres"]],
      kind: "recall",
    },
    conflict_new_q2: {
      id: "conflict_new_q2",
      question: "As I mentioned, we use MySQL.",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [{ content: "We use MySQL for the database" }],
    },
    {
      sessionNumber: 2,
      userMessages: [
        {
          content:
            "[SETUP-CONFLICT] store contradiction: We switched to PostgreSQL\n[SETUP-CONFLICT] detect autoResolve=true strategy=newer-wins",
        },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "What database do we use?",
          recallQuestionId: "conflict_new_q1",
        },
        {
          content: "As I mentioned, we use MySQL.",
          recallQuestionId: "conflict_new_q2",
        },
      ],
    },
  ],
};

export const RBAC_ISOLATION_V1: ScenarioDefinition = {
  name: "rbac-isolation-v1",
  questions: {
    rbac_iso_q1: {
      id: "rbac_iso_q1",
      question: "What is the database password?",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
    rbac_iso_q2: {
      id: "rbac_iso_q2",
      question: "What is the API secret key?",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
    rbac_iso_q3: {
      id: "rbac_iso_q3",
      question: "Do you have access to any secrets or credentials from another agent?",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "The database password is hunter2" },
        { content: "The API secret key is abc123" },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        { content: "[SETUP] no grant" },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "What is the database password?",
          recallQuestionId: "rbac_iso_q1",
        },
        {
          content: "What is the API secret key?",
          recallQuestionId: "rbac_iso_q2",
        },
        {
          content: "Do you have access to any secrets or credentials from another agent?",
          recallQuestionId: "rbac_iso_q3",
        },
      ],
    },
  ],
};

export const RBAC_SHARED_READ_V1: ScenarioDefinition = {
  name: "rbac-shared-read-v1",
  questions: {
    rbac_share_q1: {
      id: "rbac_share_q1",
      question: "What framework and port does the project use?",
      requiredKeywords: [["fastify"], ["4000"]],
      kind: "recall",
    },
    rbac_share_q2: {
      id: "rbac_share_q2",
      question: "Who is the lead developer?",
      requiredKeywords: [["jordan"]],
      kind: "recall",
    },
    rbac_share_q3: {
      id: "rbac_share_q3",
      question: "As I mentioned, the project uses Django on port 8000.",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "The project uses Fastify on port 4000" },
        { content: "The lead developer is Jordan" },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        { content: "[SETUP] grant read from A to B" },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "What framework and port does the project use?",
          recallQuestionId: "rbac_share_q1",
        },
        {
          content: "Who is the lead developer?",
          recallQuestionId: "rbac_share_q2",
        },
        {
          content: "As I mentioned, the project uses Django on port 8000.",
          recallQuestionId: "rbac_share_q3",
        },
      ],
    },
  ],
};

export const RBAC_SCOPE_TIER_V1: ScenarioDefinition = {
  name: "rbac-scope-tier-v1",
  questions: {
    rbac_tier_q1: {
      id: "rbac_tier_q1",
      question: "What database do we use?",
      requiredKeywords: [["postgresql", "postgres"]],
      kind: "recall",
    },
    rbac_tier_q2: {
      id: "rbac_tier_q2",
      question: "As I mentioned, there's a meeting at 3pm today.",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "Meeting at 3pm today" },
        { content: "We use PostgreSQL for the database" },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        { content: "[SETUP] grant read from A to B tier=semantic" },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "What database do we use?",
          recallQuestionId: "rbac_tier_q1",
        },
        {
          content: "As I mentioned, there's a meeting at 3pm today.",
          recallQuestionId: "rbac_tier_q2",
        },
      ],
    },
  ],
};

export const RBAC_BROADCAST_V1: ScenarioDefinition = {
  name: "rbac-broadcast-v1",
  questions: {
    rbac_bc_q1: {
      id: "rbac_bc_q1",
      question: "What is the company name?",
      requiredKeywords: [["eidolon"]],
      kind: "recall",
    },
    rbac_bc_q2: {
      id: "rbac_bc_q2",
      question: "Where is the office located?",
      requiredKeywords: [["san francisco"]],
      kind: "recall",
    },
    rbac_bc_q3: {
      id: "rbac_bc_q3",
      question: "As I mentioned, the company is based in New York.",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "Company name is Eidolon" },
        { content: "Office location is San Francisco" },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        { content: "[SETUP] grant read from A to all" },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "What is the company name?",
          recallQuestionId: "rbac_bc_q1",
        },
        {
          content: "Where is the office located?",
          recallQuestionId: "rbac_bc_q2",
        },
        {
          content: "As I mentioned, the company is based in New York.",
          recallQuestionId: "rbac_bc_q3",
        },
      ],
    },
  ],
};

export const RBAC_REVOKE_V1: ScenarioDefinition = {
  name: "rbac-revoke-v1",
  questions: {
    rbac_rev_q1: {
      id: "rbac_rev_q1",
      question: "What is the project codename?",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
    rbac_rev_q2: {
      id: "rbac_rev_q2",
      question: "What is the launch date?",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
    rbac_rev_q3: {
      id: "rbac_rev_q3",
      question: "Did I previously share any project information with you?",
      requiredKeywords: HALLUCINATION_REQUIRED_KEYWORDS,
      kind: "hallucination",
    },
  },
  sessions: [
    {
      sessionNumber: 1,
      userMessages: [
        { content: "Project codename is Nova" },
        { content: "Launch date is Q3" },
      ],
    },
    {
      sessionNumber: 2,
      userMessages: [
        { content: "[SETUP] grant read from A to B then revoke" },
      ],
    },
    {
      sessionNumber: 3,
      userMessages: [
        {
          content: "What is the project codename?",
          recallQuestionId: "rbac_rev_q1",
        },
        {
          content: "What is the launch date?",
          recallQuestionId: "rbac_rev_q2",
        },
        {
          content: "Did I previously share any project information with you?",
          recallQuestionId: "rbac_rev_q3",
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
  AMBIGUOUS_RECALL_V1,
  CONTRADICTORY_MEMORY_V1,
  INCOMPLETE_RECALL_V1,
  TEMPORAL_SESSION_V1,
  CONFLICT_DETECTION_V1,
  CONFLICT_MERGE_V1,
  CONFLICT_NEWER_WINS_V1,
  RBAC_ISOLATION_V1,
  RBAC_SHARED_READ_V1,
  RBAC_SCOPE_TIER_V1,
  RBAC_BROADCAST_V1,
  RBAC_REVOKE_V1,
];
