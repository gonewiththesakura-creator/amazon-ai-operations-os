import type { EvidenceReference } from "./home";

export type ChatContext = {
  business_date: string;
  marketplace: string;
  selected_asin?: string | null;
  selected_campaign?: string | null;
  home_composition_id?: string;
  previous_ai_run_id?: string;
};

export type ChatRequest = {
  message: string;
  marketplace: string;
  business_date: string;
  context: ChatContext;
};

export type FindingEnvelope = {
  finding_id: string;
  agent_id: string;
  finding_type: string;
  claim: string;
  evidence_refs: EvidenceReference[];
  data_period: { start: string; end: string };
  confidence: number;
  causal_status: "OBSERVED" | "ASSOCIATION" | "HYPOTHESIS" | "CONFIRMED_CAUSAL";
  limitations: string[];
  alternative_hypotheses: string[];
  recommended_next_step: string;
  synthetic: boolean;
};

export type ChatResponse = {
  answer: string;
  findings: FindingEnvelope[];
  evidence_refs: EvidenceReference[];
  suggested_followups: string[];
  context_snapshot: ChatContext;
  ai_run_id: string;
  synthetic: boolean;
};

