export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agenda_items: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          one_on_one_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          one_on_one_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          one_on_one_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_one_on_one_id_fkey"
            columns: ["one_on_one_id"]
            isOneToOne: false
            referencedRelation: "one_on_ones"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_followups: {
        Row: {
          agreement_id: string
          created_at: string
          id: string
          justification: string | null
          reported_by_id: string
          reported_in_one_on_one_id: string | null
          reported_status: Database["public"]["Enums"]["agreement_status"]
        }
        Insert: {
          agreement_id: string
          created_at?: string
          id?: string
          justification?: string | null
          reported_by_id: string
          reported_in_one_on_one_id?: string | null
          reported_status: Database["public"]["Enums"]["agreement_status"]
        }
        Update: {
          agreement_id?: string
          created_at?: string
          id?: string
          justification?: string | null
          reported_by_id?: string
          reported_in_one_on_one_id?: string | null
          reported_status?: Database["public"]["Enums"]["agreement_status"]
        }
        Relationships: [
          {
            foreignKeyName: "agreement_followups_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_followups_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "open_agreements_by_collaborator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_followups_reported_by_id_fkey"
            columns: ["reported_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_followups_reported_in_one_on_one_id_fkey"
            columns: ["reported_in_one_on_one_id"]
            isOneToOne: false
            referencedRelation: "one_on_ones"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          ai_confidence: number | null
          ai_generated: boolean
          ai_quality_score: number | null
          ai_quality_warnings: string[]
          created_at: string
          description: string
          due_date: string | null
          id: string
          one_on_one_id: string
          responsible_id: string
          status: Database["public"]["Enums"]["agreement_status"]
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_generated?: boolean
          ai_quality_score?: number | null
          ai_quality_warnings?: string[]
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          one_on_one_id: string
          responsible_id: string
          status?: Database["public"]["Enums"]["agreement_status"]
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_generated?: boolean
          ai_quality_score?: number | null
          ai_quality_warnings?: string[]
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          one_on_one_id?: string
          responsible_id?: string
          status?: Database["public"]["Enums"]["agreement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_one_on_one_id_fkey"
            columns: ["one_on_one_id"]
            isOneToOne: false
            referencedRelation: "one_on_ones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          collaborator_id: string
          content: Json
          created_at: string
          id: string
          leader_id: string
          one_on_one_id: string | null
          type: string
          used: boolean
        }
        Insert: {
          collaborator_id: string
          content: Json
          created_at?: string
          id?: string
          leader_id: string
          one_on_one_id?: string | null
          type: string
          used?: boolean
        }
        Update: {
          collaborator_id?: string
          content?: Json
          created_at?: string
          id?: string
          leader_id?: string
          one_on_one_id?: string | null
          type?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_one_on_one_id_fkey"
            columns: ["one_on_one_id"]
            isOneToOne: false
            referencedRelation: "one_on_ones"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_reports: {
        Row: {
          content: string
          created_at: string
          id: string
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          scope_id: string
          scope_type: string
          severity: Database["public"]["Enums"]["ai_report_severity"]
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope_id: string
          scope_type: string
          severity?: Database["public"]["Enums"]["ai_report_severity"]
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope_id?: string
          scope_type?: string
          severity?: Database["public"]["Enums"]["ai_report_severity"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          resource_id: string | null
          resource_type: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_configs: {
        Row: {
          created_at: string
          created_by: string | null
          frequency_days: number
          id: string
          scope_id: string | null
          scope_type: Database["public"]["Enums"]["cadence_scope"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          frequency_days: number
          id?: string
          scope_id?: string | null
          scope_type: Database["public"]["Enums"]["cadence_scope"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          frequency_days?: number
          id?: string
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["cadence_scope"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadence_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "compliance_metrics"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      leadership_relations: {
        Row: {
          collaborator_id: string
          created_at: string
          ended_at: string | null
          id: string
          leader_id: string
          started_at: string
          transfer_banner_dismissed_at: string | null
        }
        Insert: {
          collaborator_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          leader_id: string
          started_at?: string
          transfer_banner_dismissed_at?: string | null
        }
        Update: {
          collaborator_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          leader_id?: string
          started_at?: string
          transfer_banner_dismissed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leadership_relations_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leadership_relations_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_warmth_responses: {
        Row: {
          clarity_after_session: number
          collaborator_id: string
          comfortable_sharing: number
          conversation_quality: number
          created_at: string
          felt_heard: number
          free_comment: string | null
          id: string
          leader_engaged: number
          one_on_one_id: string
        }
        Insert: {
          clarity_after_session: number
          collaborator_id: string
          comfortable_sharing: number
          conversation_quality: number
          created_at?: string
          felt_heard: number
          free_comment?: string | null
          id?: string
          leader_engaged: number
          one_on_one_id: string
        }
        Update: {
          clarity_after_session?: number
          collaborator_id?: string
          comfortable_sharing?: number
          conversation_quality?: number
          created_at?: string
          felt_heard?: number
          free_comment?: string | null
          id?: string
          leader_engaged?: number
          one_on_one_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_warmth_responses_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_warmth_responses_one_on_one_id_fkey"
            columns: ["one_on_one_id"]
            isOneToOne: false
            referencedRelation: "one_on_ones"
            referencedColumns: ["id"]
          },
        ]
      }
      minutes: {
        Row: {
          author_id: string
          created_at: string
          id: string
          one_on_one_id: string
          processed_at: string | null
          raw_content: string
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          one_on_one_id: string
          processed_at?: string | null
          raw_content: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          one_on_one_id?: string
          processed_at?: string | null
          raw_content?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "minutes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_one_on_one_id_fkey"
            columns: ["one_on_one_id"]
            isOneToOne: false
            referencedRelation: "one_on_ones"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dispatches: {
        Row: {
          channel: string
          context: Json
          created_at: string
          delivered_at: string | null
          failed_reason: string | null
          id: string
          recipient_id: string
          rule_id: string | null
          status: string
        }
        Insert: {
          channel: string
          context: Json
          created_at?: string
          delivered_at?: string | null
          failed_reason?: string | null
          id?: string
          recipient_id: string
          rule_id?: string | null
          status?: string
        }
        Update: {
          channel?: string
          context?: Json
          created_at?: string
          delivered_at?: string | null
          failed_reason?: string | null
          id?: string
          recipient_id?: string
          rule_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_dispatches_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_dispatches_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "notification_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: string
          created_at: string
          enabled: boolean
          id: string
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          enabled?: boolean
          id?: string
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          audience: string[]
          channels: string[]
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          name: string
          threshold: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          audience?: string[]
          channels?: string[]
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name: string
          threshold?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          audience?: string[]
          channels?: string[]
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name?: string
          threshold?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          content: string
          created_at: string
          id: string
          link: string | null
          read: boolean
          sent: boolean
          title: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          content: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          sent?: boolean
          title: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          content?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          sent?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      one_on_ones: {
        Row: {
          collaborator_id: string
          created_at: string
          created_by: string
          duration_minutes: number
          google_calendar_event_id: string | null
          id: string
          leader_id: string
          location: string | null
          meet_link: string | null
          modality: Database["public"]["Enums"]["meeting_modality"]
          non_realization_marked_at: string | null
          non_realization_marked_by: string | null
          non_realization_note: string | null
          non_realization_reason:
            | Database["public"]["Enums"]["non_realization_reason"]
            | null
          scheduled_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          updated_at: string
        }
        Insert: {
          collaborator_id: string
          created_at?: string
          created_by: string
          duration_minutes?: number
          google_calendar_event_id?: string | null
          id?: string
          leader_id: string
          location?: string | null
          meet_link?: string | null
          modality: Database["public"]["Enums"]["meeting_modality"]
          non_realization_marked_at?: string | null
          non_realization_marked_by?: string | null
          non_realization_note?: string | null
          non_realization_reason?:
            | Database["public"]["Enums"]["non_realization_reason"]
            | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          updated_at?: string
        }
        Update: {
          collaborator_id?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number
          google_calendar_event_id?: string | null
          id?: string
          leader_id?: string
          location?: string | null
          meet_link?: string | null
          modality?: Database["public"]["Enums"]["meeting_modality"]
          non_realization_marked_at?: string | null
          non_realization_marked_by?: string | null
          non_realization_note?: string | null
          non_realization_reason?:
            | Database["public"]["Enums"]["non_realization_reason"]
            | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_on_ones_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_ones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_ones_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_ones_non_realization_marked_by_fkey"
            columns: ["non_realization_marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          filters: Json | null
          format: string
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          recipients: string[]
          report_type: string
          schedule_cron: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          filters?: Json | null
          format?: string
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          recipients?: string[]
          report_type: string
          schedule_cron: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          filters?: Json | null
          format?: string
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          recipients?: string[]
          report_type?: string
          schedule_cron?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          allow_share_warmth_comments: boolean
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          google_calendar_token: Json | null
          google_id: string | null
          hr_employee_id: string | null
          id: string
          is_active: boolean
          nivel_puesto: string | null
          proyecto: string | null
          puesto: string | null
          role: Database["public"]["Enums"]["user_role"]
          slack_user_id: string | null
          sub_area: string | null
          updated_at: string
        }
        Insert: {
          allow_share_warmth_comments?: boolean
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          full_name: string
          google_calendar_token?: Json | null
          google_id?: string | null
          hr_employee_id?: string | null
          id: string
          is_active?: boolean
          nivel_puesto?: string | null
          proyecto?: string | null
          puesto?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          slack_user_id?: string | null
          sub_area?: string | null
          updated_at?: string
        }
        Update: {
          allow_share_warmth_comments?: boolean
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          google_calendar_token?: Json | null
          google_id?: string | null
          hr_employee_id?: string | null
          id?: string
          is_active?: boolean
          nivel_puesto?: string | null
          proyecto?: string | null
          puesto?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          slack_user_id?: string | null
          sub_area?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "compliance_metrics"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      vobos: {
        Row: {
          confirmed: boolean
          confirmed_at: string
          id: string
          one_on_one_id: string
          user_id: string
        }
        Insert: {
          confirmed: boolean
          confirmed_at?: string
          id?: string
          one_on_one_id: string
          user_id: string
        }
        Update: {
          confirmed?: boolean
          confirmed_at?: string
          id?: string
          one_on_one_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vobos_one_on_one_id_fkey"
            columns: ["one_on_one_id"]
            isOneToOne: false
            referencedRelation: "one_on_ones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vobos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      compliance_metrics: {
        Row: {
          compliance_rate: number | null
          department_id: string | null
          department_name: string | null
          disputed_meetings: number | null
          fulfilled_agreements: number | null
          missed_meetings: number | null
          realized_meetings: number | null
          total_agreements: number | null
          total_meetings: number | null
          unfulfilled_agreements: number | null
        }
        Relationships: []
      }
      compliance_metrics_by_leader: {
        Row: {
          compliance_rate: number | null
          department_id: string | null
          direct_reports: number | null
          leader_id: string | null
          leader_name: string | null
          realized_meetings: number | null
          total_meetings: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leadership_relations_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "compliance_metrics"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      open_agreements_by_collaborator: {
        Row: {
          ai_confidence: number | null
          ai_generated: boolean | null
          ai_quality_score: number | null
          ai_quality_warnings: string[] | null
          collaborator_id: string | null
          created_at: string | null
          current_leader_id: string | null
          description: string | null
          due_date: string | null
          id: string | null
          is_transferred: boolean | null
          one_on_one_id: string | null
          original_leader_id: string | null
          responsible_id: string | null
          session_scheduled_at: string | null
          status: Database["public"]["Enums"]["agreement_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreements_one_on_one_id_fkey"
            columns: ["one_on_one_id"]
            isOneToOne: false
            referencedRelation: "one_on_ones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leadership_relations_leader_id_fkey"
            columns: ["current_leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_ones_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_ones_leader_id_fkey"
            columns: ["original_leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      overdue_relations: {
        Row: {
          cadence_days: number | null
          collaborator_id: string | null
          collaborator_name: string | null
          days_since: number | null
          department_id: string | null
          department_name: string | null
          is_overdue: boolean | null
          last_meeting_at: string | null
          leader_email: string | null
          leader_id: string | null
          leader_name: string | null
          leader_slack_user_id: string | null
          relation_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leadership_relations_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leadership_relations_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "compliance_metrics"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      warmth_metrics_by_department: {
        Row: {
          avg_overall: number | null
          department_id: string | null
          department_name: string | null
          response_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "compliance_metrics"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      warmth_metrics_by_leader: {
        Row: {
          avg_clarity_after_session: number | null
          avg_comfortable_sharing: number | null
          avg_conversation_quality: number | null
          avg_felt_heard: number | null
          avg_leader_engaged: number | null
          avg_overall: number | null
          leader_id: string | null
          response_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "one_on_ones_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      warmth_trend_by_leader_month: {
        Row: {
          avg_overall: number | null
          leader_id: string | null
          month: string | null
          response_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "one_on_ones_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_hr: { Args: never; Returns: boolean }
      is_leader_of: { Args: { p_collaborator_id: string }; Returns: boolean }
      is_participant: { Args: { p_one_on_one_id: string }; Returns: boolean }
    }
    Enums: {
      agreement_status: "pendiente" | "cumplido" | "parcial" | "no_cumplido"
      ai_report_severity: "info" | "warning" | "critical"
      cadence_scope: "global" | "department" | "relation"
      meeting_modality: "virtual" | "presencial"
      meeting_status: "agendada" | "realizada" | "no_realizada" | "en_disputa"
      non_realization_reason:
        | "reagendada"
        | "cancelada_cargas"
        | "ausencia"
        | "sin_justificacion"
        | "emergencia"
        | "vacaciones"
      notification_channel: "in_app" | "email" | "slack"
      user_role: "collaborator" | "leader" | "hr"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agreement_status: ["pendiente", "cumplido", "parcial", "no_cumplido"],
      ai_report_severity: ["info", "warning", "critical"],
      cadence_scope: ["global", "department", "relation"],
      meeting_modality: ["virtual", "presencial"],
      meeting_status: ["agendada", "realizada", "no_realizada", "en_disputa"],
      non_realization_reason: [
        "reagendada",
        "cancelada_cargas",
        "ausencia",
        "sin_justificacion",
        "emergencia",
        "vacaciones",
      ],
      notification_channel: ["in_app", "email", "slack"],
      user_role: ["collaborator", "leader", "hr"],
    },
  },
} as const

