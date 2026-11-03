// Bentuk data dari agent-backend (lihat README backend untuk kontrak lengkap).

export interface Session {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  refresh_expires_at: string;
  owner: { username: string };
}

export interface TargetStatus {
  ok: boolean;
  status_code: number | null;
  latency_ms: number | null;
  error_class: string | null;
  ssl_days_left: number | null;
  checked_at: string;
  uptime_24h_pct: number | null;
  avg_latency_24h_ms: number | null;
}

export interface Incident {
  id: number;
  site_id?: string;
  kind: string;
  detail: string | null;
  opened_at: string;
  closed_at?: string | null;
}

export interface SiteSummary {
  id: string;
  name: string;
  enabled: boolean;
  frontend_url: string | null;
  backend_url: string | null;
  targets: { frontend: TargetStatus | null; backend: TargetStatus | null };
  open_incidents: Incident[];
  metrics: Record<string, { value: number; at: string }>;
  agent_credential: 'active' | 'pending' | 'none';
}

export interface SiteDetail extends SiteSummary {
  recent_incidents: Incident[];
}

export interface CheckPoint {
  checked_at: string;
  target: 'frontend' | 'backend';
  ok?: boolean;
  status_code?: number | null;
  latency_ms?: number | null;
  error_class?: string | null;
  checks?: number;
  failures?: number;
  avg_latency_ms?: number | null;
  max_latency_ms?: number | null;
}

export interface ChecksResponse {
  range: string;
  kind: 'raw' | 'hourly';
  points: CheckPoint[];
}

export type RunStatus = 'running' | 'ok' | 'error' | 'denied' | 'killed' | 'pending_approval';
export type Risk = 'READ' | 'WRITE' | 'DANGER';

export interface ToolRun {
  id: string;
  session_id: string | null;
  scheduled_task_id: string | null;
  tool_name: string;
  site_id: string | null;
  risk: Risk;
  actor: 'agent' | 'owner' | 'scheduler' | 'system';
  status: RunStatus;
  error: string | null;
  duration_ms: number | null;
  approval_id: string | null;
  started_at: string;
  finished_at: string | null;
  input?: unknown;
  output_summary?: unknown;
}

export interface Approval {
  id: string;
  tool_name: string;
  site_id: string | null;
  risk: Risk;
  status: 'pending' | 'executing' | 'executed' | 'failed' | 'rejected' | 'expired';
  input_preview: string;
  input: unknown;
  reason: string | null;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  executed_at: string | null;
  result: unknown;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  created_at: string;
}

export interface Item {
  id: string;
  kind: 'note' | 'reminder' | 'todo';
  title: string;
  body: string | null;
  due_at: string | null;
  status: 'open' | 'done' | 'cancelled';
  created_by: string;
  created_at: string;
}

export interface Task {
  id: string;
  name: string;
  kind: 'tool' | 'prompt';
  tool_name: string | null;
  input: Record<string, unknown>;
  prompt: string | null;
  interval_seconds: number | null;
  daily_at: string | null;
  notify_telegram: boolean;
  enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
}

export interface ToolInfo {
  name: string;
  site: string | null;
  risk: Risk;
  description: string;
  parameters: { properties?: Record<string, unknown> };
  schedulable: boolean;
}

export interface KillState {
  active: boolean;
  by: string | null;
  at: string | null;
  reason: string | null;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: string | null;
  ip: string | null;
  detail: unknown;
}

export interface SettingsValues {
  monitor_interval_seconds: number;
  metrics_interval_seconds: number;
  down_after_failures: number;
  slow_latency_ms: number;
  slow_after_checks: number;
  ssl_warn_days: number;
  pending_age_minutes: number;
  ai_model: string;
  ai_max_output_tokens: number;
  ai_daily_token_limit: number;
  ai_daily_budget_usd: number;
  telegram_enabled: boolean;
}

export interface SettingsResponse {
  settings: SettingsValues;
  ai: {
    enabled: boolean;
    tool_mode: string;
    base_url_host: string | null;
    env_ceiling: { daily_token_limit: number; daily_budget_usd: number; max_output_tokens: number };
    effective: { tokenLimit: number; budgetUsd: number; maxOutputTokens: number };
  };
  telegram: { configured: boolean };
}

export interface AiUsage {
  days: { day: string; requests: number; tokens_in: number; tokens_out: number; cost_usd: number }[];
  today: { tokens: number; cost: number };
  limits: { tokenLimit: number; budgetUsd: number; maxOutputTokens: number };
  priced: boolean;
}

export interface CredentialRow {
  site_id: string;
  key_id: string;
  status: 'pending' | 'active' | 'retired' | 'revoked';
  created_at: string;
  activated_at: string | null;
  revoked_at: string | null;
}
