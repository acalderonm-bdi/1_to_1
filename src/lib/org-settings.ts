import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_WARMTH_QUESTIONS = [
  { key: 'felt_heard', label: 'Me sentí escuchada/o en esta sesión' },
  { key: 'comfortable_sharing', label: 'Me sentí cómoda/o compartiendo lo que pensaba' },
  { key: 'leader_engaged', label: 'Sentí que mi líder estuvo presente y enfocada/o' },
  { key: 'conversation_quality', label: 'La conversación fue significativa para mí' },
  { key: 'clarity_after_session', label: 'Salí con claridad de los próximos pasos' },
]

const aiFeaturesSchema = z.object({
  extract_agreements: z.boolean().default(true),
  suggest_questions: z.boolean().default(true),
  analyze_patterns: z.boolean().default(true),
  refine_agreement: z.boolean().default(true),
})

export const SETTING_SCHEMAS = {
  agreement_quality_threshold: z.number().min(0).max(5).default(3.0),
  collaborator_max_open_agreements: z.number().int().min(1).max(50).default(7),
  warmth_survey_required: z.boolean().default(true),
  warmth_questions: z
    .array(z.object({ key: z.string(), label: z.string().max(200) }))
    .min(3)
    .max(7)
    .default(DEFAULT_WARMTH_QUESTIONS),
  ai_features: aiFeaturesSchema.default({
    extract_agreements: true,
    suggest_questions: true,
    analyze_patterns: true,
    refine_agreement: true,
  }),
  ai_model: z
    .enum(['claude-sonnet-4-5', 'claude-haiku-4-5-20251001'])
    .default('claude-sonnet-4-5'),
  ai_monthly_budget_usd: z.number().min(0).default(100),
  non_realization_max_days: z.number().int().min(1).max(90).default(7),
  transfer_banner_enabled: z.boolean().default(true),
} as const

export type SettingKey = keyof typeof SETTING_SCHEMAS
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>

const cache = new Map<SettingKey, { value: unknown; at: number }>()
const CACHE_TTL_MS = 30_000

export async function getOrgSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value as SettingValue<K>
  }
  const schema = SETTING_SCHEMAS[key]
  const supabase = createClient()
  const { data } = await supabase
    .from('org_settings' as never)
    .select('value')
    .eq('key' as never, key)
    .maybeSingle() as unknown as { data: { value: unknown } | null }
  const parsed = schema.safeParse(data?.value)
  const value = (parsed.success ? parsed.data : schema.parse(undefined)) as SettingValue<K>
  cache.set(key, { value, at: Date.now() })
  return value
}

export async function setOrgSetting<K extends SettingKey>(
  key: K,
  value: unknown,
  userId: string,
): Promise<SettingValue<K>> {
  const schema = SETTING_SCHEMAS[key]
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new Error(`Invalid value for ${key}: ${parsed.error.message}`)
  const supabase = createClient()
  const { error } = await supabase.from('org_settings' as never).upsert({
    key,
    value: parsed.data,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  } as never)
  if (error) throw error
  cache.delete(key)
  return parsed.data as SettingValue<K>
}

export function invalidateOrgSettingCache(key?: SettingKey) {
  if (key) cache.delete(key)
  else cache.clear()
}
