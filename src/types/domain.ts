import type { Database } from './database.types'

export type User = Database['public']['Tables']['users']['Row']
export type Department = Database['public']['Tables']['departments']['Row']
export type LeadershipRelation = Database['public']['Tables']['leadership_relations']['Row']
export type CadenceConfig = Database['public']['Tables']['cadence_configs']['Row']
export type OneOnOne = Database['public']['Tables']['one_on_ones']['Row']
export type AgendaItem = Database['public']['Tables']['agenda_items']['Row']
export type Minute = Database['public']['Tables']['minutes']['Row']
export type Agreement = Database['public']['Tables']['agreements']['Row']
export type AgreementFollowup = Database['public']['Tables']['agreement_followups']['Row']
export type Vobo = Database['public']['Tables']['vobos']['Row']
export type AIInsight = Database['public']['Tables']['ai_insights']['Row']
export type AIReport = Database['public']['Tables']['ai_reports']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type ComplianceMetric = Database['public']['Views']['compliance_metrics']['Row']

export type UserRole = Database['public']['Enums']['user_role']
export type MeetingModality = Database['public']['Enums']['meeting_modality']
export type MeetingStatus = Database['public']['Enums']['meeting_status']
export type NonRealizationReason = Database['public']['Enums']['non_realization_reason']
export type AgreementStatus = Database['public']['Enums']['agreement_status']
export type NotificationChannel = Database['public']['Enums']['notification_channel']
export type AIReportSeverity = Database['public']['Enums']['ai_report_severity']
export type CadenceScope = Database['public']['Enums']['cadence_scope']

export interface OneOnOneWithParticipants extends OneOnOne {
  leader: User
  collaborator: User
  agreements?: Agreement[]
  vobos?: Vobo[]
}

export interface AgreementWithFollowups extends Agreement {
  followups: AgreementFollowup[]
  responsible: User
}

export interface ExtractedAgreement {
  description: string
  responsible_email: string
  due_date: string | null
  confidence: number
}

export interface SuggestedQuestion {
  question: string
  rationale: string
  category: 'desempeño' | 'desarrollo' | 'bienestar' | 'seguimiento' | 'feedback'
}

export interface FollowupPlan {
  summary: string
  actions: Array<{
    action: string
    timeline: string
    importance: 'alta' | 'media' | 'baja'
  }>
}

export interface PatternAnalysis {
  pattern_detected: boolean
  severity: AIReportSeverity
  title: string
  description: string
  recommendations: string[]
}

export interface ActionResult<T = undefined> {
  success: boolean
  data?: T
  error?: string
}
