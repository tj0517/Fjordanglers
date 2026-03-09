// ─────────────────────────────────────────────────────────────────────────────
// AUTO-GENERATED — do NOT edit manually.
// Regenerate with:  pnpm supabase:types
//
// This hand-crafted placeholder matches the schema in:
//   supabase/migrations/20260301181748_initial_schema.sql
//   supabase/migrations/20260306164010_add_beta_listings_support.sql
//   supabase/migrations/20260306170000_add_lead_bridge_to_guides.sql
//   supabase/migrations/20260307100000_drop_best_months_from_experiences.sql
//   supabase/migrations/20260307194815_add_experience_calendar_config.sql
//
// Will be overwritten once `supabase gen types typescript --local` runs.
// ─────────────────────────────────────────────────────────────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: 'guide' | 'angler' | 'admin'
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: 'guide' | 'angler' | 'admin'
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'guide' | 'angler' | 'admin'
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      guides: {
        Row: {
          id: string
          user_id: string | null          // nullable — beta listings have no linked auth user
          full_name: string
          bio: string | null
          avatar_url: string | null
          cover_url: string | null
          country: string
          city: string | null
          languages: string[]
          years_experience: number | null
          fish_expertise: string[]
          certifications: string | null
          instagram_url: string | null
          youtube_url: string | null
          status: Database['public']['Enums']['guide_status']
          pricing_model: Database['public']['Enums']['pricing_model']
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_payouts_enabled: boolean
          verified_at: string | null
          average_rating: number | null
          total_reviews: number
          is_beta_listing: boolean        // admin-created preview, no dashboard access
          invite_email: string | null     // email for claim flow (guide registers → auto-link)
          lead_id: string | null          // FK to leads — audit trail for pipeline
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          full_name: string
          bio?: string | null
          avatar_url?: string | null
          cover_url?: string | null
          country: string
          city?: string | null
          languages?: string[]
          years_experience?: number | null
          fish_expertise?: string[]
          certifications?: string | null
          instagram_url?: string | null
          youtube_url?: string | null
          status?: Database['public']['Enums']['guide_status']
          pricing_model?: Database['public']['Enums']['pricing_model']
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          verified_at?: string | null
          average_rating?: number | null
          total_reviews?: number
          is_beta_listing?: boolean
          invite_email?: string | null
          lead_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          full_name?: string
          bio?: string | null
          avatar_url?: string | null
          cover_url?: string | null
          country?: string
          city?: string | null
          languages?: string[]
          years_experience?: number | null
          fish_expertise?: string[]
          certifications?: string | null
          instagram_url?: string | null
          youtube_url?: string | null
          status?: Database['public']['Enums']['guide_status']
          pricing_model?: Database['public']['Enums']['pricing_model']
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          verified_at?: string | null
          average_rating?: number | null
          total_reviews?: number
          is_beta_listing?: boolean
          invite_email?: string | null
          lead_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'guides_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      experiences: {
        Row: {
          id: string
          guide_id: string
          title: string
          description: string
          fish_types: string[]
          duration_days: number | null
          duration_hours: number | null
          max_guests: number
          price_per_person_eur: number
          difficulty: 'beginner' | 'intermediate' | 'expert' | null
          what_included: string[]
          what_excluded: string[]
          meeting_point: string | null
          location_country: string | null
          location_city: string | null
          technique: string | null
          catch_and_release: boolean
          location_lat: number | null
          location_lng: number | null
          published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          guide_id: string
          title: string
          description: string
          fish_types?: string[]
          duration_days?: number | null
          duration_hours?: number | null
          max_guests?: number
          price_per_person_eur: number
          difficulty?: 'beginner' | 'intermediate' | 'expert' | null
          what_included?: string[]
          what_excluded?: string[]
          meeting_point?: string | null
          location_country?: string | null
          location_city?: string | null
          technique?: string | null
          catch_and_release?: boolean
          location_lat?: number | null
          location_lng?: number | null
          published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          guide_id?: string
          title?: string
          description?: string
          fish_types?: string[]
          duration_days?: number | null
          duration_hours?: number | null
          max_guests?: number
          price_per_person_eur?: number
          difficulty?: 'beginner' | 'intermediate' | 'expert' | null
          what_included?: string[]
          what_excluded?: string[]
          meeting_point?: string | null
          location_country?: string | null
          location_city?: string | null
          technique?: string | null
          catch_and_release?: boolean
          location_lat?: number | null
          location_lng?: number | null
          published?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'experiences_guide_id_fkey'
            columns: ['guide_id']
            isOneToOne: false
            referencedRelation: 'guides'
            referencedColumns: ['id']
          },
        ]
      }
      experience_images: {
        Row: {
          id: string
          experience_id: string
          url: string
          sort_order: number
          is_cover: boolean
          created_at: string
        }
        Insert: {
          id?: string
          experience_id: string
          url: string
          sort_order?: number
          is_cover?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          experience_id?: string
          url?: string
          sort_order?: number
          is_cover?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'experience_images_experience_id_fkey'
            columns: ['experience_id']
            isOneToOne: false
            referencedRelation: 'experiences'
            referencedColumns: ['id']
          },
        ]
      }
      experience_availability_config: {
        Row: {
          experience_id: string           // PK = FK to experiences (1-to-1)
          available_months: number[]      // 1–12; empty = year-round
          available_weekdays: number[]    // 0=Sun … 6=Sat; empty = every day
          advance_notice_hours: number    // min hours of advance notice required
          max_advance_days: number        // how far ahead the booking calendar opens
          slots_per_day: number           // max parallel bookings on the same date
          start_time: string | null       // HH:MM:SS — departure/meeting time
          created_at: string
          updated_at: string
        }
        Insert: {
          experience_id: string
          available_months?: number[]
          available_weekdays?: number[]
          advance_notice_hours?: number
          max_advance_days?: number
          slots_per_day?: number
          start_time?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          experience_id?: string
          available_months?: number[]
          available_weekdays?: number[]
          advance_notice_hours?: number
          max_advance_days?: number
          slots_per_day?: number
          start_time?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'experience_availability_config_experience_id_fkey'
            columns: ['experience_id']
            isOneToOne: true
            referencedRelation: 'experiences'
            referencedColumns: ['id']
          },
        ]
      }
      experience_blocked_dates: {
        Row: {
          id: string
          experience_id: string
          date_start: string              // DATE — first unavailable date (inclusive)
          date_end: string                // DATE — last unavailable date (inclusive)
          reason: string | null           // internal note, not shown to anglers
          created_at: string
        }
        Insert: {
          id?: string
          experience_id: string
          date_start: string
          date_end: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          experience_id?: string
          date_start?: string
          date_end?: string
          reason?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'experience_blocked_dates_experience_id_fkey'
            columns: ['experience_id']
            isOneToOne: false
            referencedRelation: 'experiences'
            referencedColumns: ['id']
          },
        ]
      }
      bookings: {
        Row: {
          id: string
          experience_id: string
          angler_id: string
          guide_id: string
          booking_date: string
          guests: number
          status: Database['public']['Enums']['booking_status']
          total_eur: number
          platform_fee_eur: number
          guide_payout_eur: number
          special_requests: string | null
          angler_full_name: string | null
          angler_phone: string | null
          angler_country: string | null
          cancelled_reason: string | null
          confirmed_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          experience_id: string
          angler_id: string
          guide_id: string
          booking_date: string
          guests?: number
          status?: Database['public']['Enums']['booking_status']
          total_eur: number
          platform_fee_eur?: number
          guide_payout_eur: number
          special_requests?: string | null
          angler_full_name?: string | null
          angler_phone?: string | null
          angler_country?: string | null
          cancelled_reason?: string | null
          confirmed_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          experience_id?: string
          angler_id?: string
          guide_id?: string
          booking_date?: string
          guests?: number
          status?: Database['public']['Enums']['booking_status']
          total_eur?: number
          platform_fee_eur?: number
          guide_payout_eur?: number
          special_requests?: string | null
          angler_full_name?: string | null
          angler_phone?: string | null
          angler_country?: string | null
          cancelled_reason?: string | null
          confirmed_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bookings_experience_id_fkey'
            columns: ['experience_id']
            isOneToOne: false
            referencedRelation: 'experiences'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_guide_id_fkey'
            columns: ['guide_id']
            isOneToOne: false
            referencedRelation: 'guides'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_angler_id_fkey'
            columns: ['angler_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      payments: {
        Row: {
          id: string
          booking_id: string
          stripe_payment_intent_id: string
          amount_eur: number
          currency: string
          status: Database['public']['Enums']['payment_status']
          stripe_transfer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          stripe_payment_intent_id: string
          amount_eur: number
          currency?: string
          status?: Database['public']['Enums']['payment_status']
          stripe_transfer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          stripe_payment_intent_id?: string
          amount_eur?: number
          currency?: string
          status?: Database['public']['Enums']['payment_status']
          stripe_transfer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payments_booking_id_fkey'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          },
        ]
      }
      leads: {
        Row: {
          id: string
          instagram_handle: string | null
          name: string | null
          country: string | null
          fish_types: string[]
          status: 'new' | 'contacted' | 'responded' | 'onboarded' | 'rejected'
          notes: string | null
          contacted_at: string | null
          responded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          instagram_handle?: string | null
          name?: string | null
          country?: string | null
          fish_types?: string[]
          status?: 'new' | 'contacted' | 'responded' | 'onboarded' | 'rejected'
          notes?: string | null
          contacted_at?: string | null
          responded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          instagram_handle?: string | null
          name?: string | null
          country?: string | null
          fish_types?: string[]
          status?: 'new' | 'contacted' | 'responded' | 'onboarded' | 'rejected'
          notes?: string | null
          contacted_at?: string | null
          responded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      guide_status: 'pending' | 'verified' | 'active' | 'suspended'
      pricing_model: 'flat_fee' | 'commission'
      booking_status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'refunded'
      payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
  ? (DefaultSchema['Tables'] &
      DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
  ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
  : never
