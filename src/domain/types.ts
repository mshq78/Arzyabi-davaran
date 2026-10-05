/**
 * GERA Domain Types
 */

export type Role = "SYSTEM_ADMIN" | "EVENT_ADMIN" | "FACILITATOR";
export type EventStatus = "Draft" | "Active" | "Closed" | "Archived";
export type ActivityStatus = "Draft" | "Open" | "Closed";
export type AssignmentStatus = "Active" | "Revoked" | "Expired";
export type AssignmentKind = "group" | "individual" | "override";
export type ObservationStatus = "PendingLocal" | "Synced" | "Corrected" | "Voided";
export type Polarity = "positive" | "warning";

export interface User {
  id: string;
  full_name: string;
  mobile_or_username: string;
  password_hash: string;
  role: Role;
  status: "Active" | "Inactive";
  temp_password?: string;
  last_active_at?: string;
}

export interface Session {
  token: string;
  user_id: string;
  expires_at: number; // timestamp ms
  remember_me: boolean;
}

export interface Event {
  id: string;
  title: string;
  event_date: string; // ISO format or date string
  location: string;
  description: string;
  status: EventStatus;
  created_by: string;
}

export interface EventMember {
  id: string;
  event_id: string;
  user_id: string;
  role: Role;
}

export interface Activity {
  id: string;
  event_id: string;
  title: string;
  order_no: number;
  starts_at?: string;
  ends_at?: string;
  status: ActivityStatus;
  opened_at?: string;
  closed_at?: string;
}

export interface Group {
  id: string;
  event_id: string;
  code: string;
  title: string;
}

export interface Participant {
  id: string;
  event_id: string;
  participant_code: string;
  full_name: string;
  personnel_code?: string;
  organization?: string;
  job_title?: string;
  group_id: string;
  status: "Active" | "Inactive";
}

export interface Assignment {
  id: string;
  event_id: string;
  activity_id: string;
  facilitator_id: string;
  kind: AssignmentKind;
  group_id?: string;
  participant_id?: string;
  status: AssignmentStatus;
  created_at: string;
  revoked_at?: string;
}

export interface BehaviorCatalog {
  id: string;
  code: string;
  label_fa: string;
  guide_fa: string; // فقط در پنل مدیر سیستم نمایش داده شود
  polarity: Polarity;
  active: boolean;
  display_order: number;
  version: number;
}

export interface Observation {
  id: string;
  offline_uuid: string; // UNIQUE
  event_id: string;
  activity_id: string;
  participant_id: string;
  facilitator_id: string;
  note?: string;
  client_created_at: string;
  server_created_at?: string;
  status: ObservationStatus;
  device_id: string;
  behavior_codes: string[];
}

export interface CoverageMark {
  id: string;
  offline_uuid: string; // UNIQUE
  event_id: string;
  activity_id: string;
  participant_id: string;
  facilitator_id: string;
  type: "NO_OPPORTUNITY";
  client_created_at: string;
  created_at?: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json?: string;
  after_json?: string;
  created_at: string;
}

export interface OnboardingAck {
  user_id: string;
  event_id: string;
  acked_at: string;
}

export interface OutboxItem {
  client_op_id: string;
  type: "CREATE_OBSERVATION" | "PATCH_OBSERVATION" | "VOID_OBSERVATION" | "CREATE_NO_OPPORTUNITY";
  payload: any;
  created_at: string;
  retry_count: number;
  last_error?: string;
  status: "pending" | "failed";
}

export interface SyncResultItem {
  offline_uuid: string;
  observation_id?: string;
  status: "synced" | "error";
  code?: string;
  message?: string;
  server_created_at?: string;
}

export interface SyncBatchResponse {
  results: SyncResultItem[];
}

export interface EffectiveParticipant extends Participant {
  group_code?: string;
  group_title?: string;
  has_observation?: boolean; // خنثی: آیا ثبتی داشته یا هنوز ثبت نشده
}
