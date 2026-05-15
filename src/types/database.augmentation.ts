/**
 * Manual type augmentation: domain-level narrowing for tables whose columns
 * are stored as generic `string`/`Json` at the DB level but actually carry a
 * narrower meaning enforced by zod schemas in the server actions.
 *
 * Most types previously declared here (warmth_*, org_settings, meeting_warmth_*,
 * justification columns, transfer banner, ai_quality_*, open_agreements view)
 * are now present in the generated `database.types.ts` and have been removed
 * from this file. What remains are unions that the DB cannot express:
 *
 *   - notification_rules.trigger_type   → NotificationTriggerType
 *   - notification_rules.audience       → NotificationAudience[]
 *   - notification_rules.channels       → NotificationChannelExt[]
 *   - notification_rules.threshold      → structured object (Json at the DB)
 *   - notification_dispatches.channel/status → narrowed unions
 *   - scheduled_reports.report_type     → ScheduledReportType
 *
 * Writes go through zod (see notification-rules.ts, scheduled-reports.ts),
 * so reads narrowing to these aliases is sound at the boundary.
 */

export type NotificationTriggerType =
  | 'cumplimiento_bajo'
  | 'acuerdo_vencido'
  | 'vobo_pendiente'
  | 'calidez_baja'
  | 'disputa_nueva'
  | 'reminder_pre_1to1'

export type NotificationAudience = 'leader' | 'collaborator' | 'hr'
export type NotificationChannelExt = 'in_app' | 'email' | 'slack'

export interface NotificationRuleRow {
  id: string
  name: string
  enabled: boolean
  trigger_type: NotificationTriggerType
  threshold: {
    value?: number
    unit?: 'percent' | 'days' | 'score'
    scope?: 'global' | 'department' | 'leader'
    days?: number
  } | null
  audience: NotificationAudience[]
  channels: NotificationChannelExt[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ScheduledReportType =
  | 'cumplimiento_mensual'
  | 'acuerdos_baja_calidad'
  | 'calidez_por_lider'

export interface ScheduledReportRow {
  id: string
  name: string
  enabled: boolean
  report_type: ScheduledReportType
  schedule_cron: string
  recipients: string[]
  format: 'csv'
  filters: Record<string, unknown> | null
  last_run_at: string | null
  next_run_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
