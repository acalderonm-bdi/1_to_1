/**
 * Manual type augmentation for new tables/columns added in mejoras-1to1.
 *
 * These types reflect the schema introduced by migrations 7a/7b/8/9/10/11
 * (Phase A of `docs/superpowers/plans/2026-05-13-mejoras-1to1-pack-a-b.md`).
 *
 * Background: `pnpm db:types` regenerates `database.types.ts` against the
 * REMOTE Supabase project. As of this commit the remote DB still lacks the
 * Phase A migrations (they live only locally), so the regenerated file would
 * NOT contain these types and would in fact drift from the local code.
 * Once the migrations are pushed and `pnpm db:types` runs cleanly, the file
 * below can be deleted and the canonical generated types in
 * `database.types.ts` will provide them.
 */

export type NonRealizationReasonExtended =
  | 'reagendada'
  | 'cancelada_cargas'
  | 'ausencia'
  | 'emergencia'
  | 'vacaciones'
  | 'sin_justificacion'

export interface OneOnOneJustificationExtension {
  non_realization_note: string | null
  non_realization_marked_by: string | null
  non_realization_marked_at: string | null
}

export interface AgreementQualityExtension {
  ai_quality_score: number | null
  ai_quality_warnings: string[]
}

export interface LeadershipRelationsDismissalExtension {
  transfer_banner_dismissed_at: string | null
}

export interface UserWarmthOptIn {
  allow_share_warmth_comments: boolean
}

export interface OpenAgreementByCollaborator {
  id: string
  one_on_one_id: string
  description: string
  responsible_id: string
  due_date: string | null
  status: 'pendiente' | 'parcial' // view filters to these statuses
  ai_generated: boolean
  ai_confidence: number | null
  ai_quality_score: number | null
  ai_quality_warnings: string[]
  created_at: string
  updated_at: string
  original_leader_id: string
  collaborator_id: string
  current_leader_id: string | null
  is_transferred: boolean
  session_scheduled_at: string
}

export interface MeetingWarmthResponse {
  id: string
  one_on_one_id: string
  collaborator_id: string
  felt_heard: number
  comfortable_sharing: number
  leader_engaged: number
  conversation_quality: number
  clarity_after_session: number
  free_comment: string | null
  created_at: string
}

export interface WarmthMetricsByLeader {
  leader_id: string
  response_count: number
  avg_felt_heard: number
  avg_comfortable_sharing: number
  avg_leader_engaged: number
  avg_conversation_quality: number
  avg_clarity_after_session: number
  avg_overall: number
}

export interface WarmthMetricsByDepartment {
  department_id: string | null
  department_name: string | null
  response_count: number
  avg_overall: number
}

export interface WarmthTrendByLeaderMonth {
  leader_id: string
  month: string
  response_count: number
  avg_overall: number
}
