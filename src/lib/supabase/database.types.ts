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
      ad_campaign_defs: {
        Row: {
          active: boolean
          created_at: string | null
          google_campaign_id: string | null
          id: string
          key: string
          name: string
          platform: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          google_campaign_id?: string | null
          id?: string
          key: string
          name: string
          platform: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string | null
          google_campaign_id?: string | null
          id?: string
          key?: string
          name?: string
          platform?: string
          sort_order?: number
        }
        Relationships: []
      }
      ad_campaigns: {
        Row: {
          avg_cpc: number
          campaign_name: string
          clicks: number
          created_at: string | null
          date: string
          id: string
          impressions: number
          platform: string
          spend: number
        }
        Insert: {
          avg_cpc?: number
          campaign_name: string
          clicks?: number
          created_at?: string | null
          date: string
          id?: string
          impressions?: number
          platform?: string
          spend?: number
        }
        Update: {
          avg_cpc?: number
          campaign_name?: string
          clicks?: number
          created_at?: string | null
          date?: string
          id?: string
          impressions?: number
          platform?: string
          spend?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          created_at: string
          id: string
          intro: string | null
          iso_code: string | null
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["publish_state"]
          tagline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          intro?: string | null
          iso_code?: string | null
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publish_state"]
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          intro?: string | null
          iso_code?: string | null
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publish_state"]
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expedition_guides: {
        Row: {
          availability_confidence: string
          created_at: string
          excludes: string[]
          expedition_id: string
          gear_policy: string | null
          guide_id: string
          includes: string[]
          internal_notes: string | null
          is_lead: boolean
          last_confirmed_at: string | null
          licence_policy: string | null
          max_rods: number | null
          pickup_from: string | null
          rate_cents: number | null
          rate_unit: string | null
          updated_at: string
        }
        Insert: {
          availability_confidence?: string
          created_at?: string
          excludes?: string[]
          expedition_id: string
          gear_policy?: string | null
          guide_id: string
          includes?: string[]
          internal_notes?: string | null
          is_lead?: boolean
          last_confirmed_at?: string | null
          licence_policy?: string | null
          max_rods?: number | null
          pickup_from?: string | null
          rate_cents?: number | null
          rate_unit?: string | null
          updated_at?: string
        }
        Update: {
          availability_confidence?: string
          created_at?: string
          excludes?: string[]
          expedition_id?: string
          gear_policy?: string | null
          guide_id?: string
          includes?: string[]
          internal_notes?: string | null
          is_lead?: boolean
          last_confirmed_at?: string | null
          licence_policy?: string | null
          max_rods?: number | null
          pickup_from?: string | null
          rate_cents?: number | null
          rate_unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expedition_guides_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedition_guides_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      expedition_options: {
        Row: {
          content_blocks: Json
          created_at: string
          currency: string
          description: string | null
          excludes: string[]
          expedition_id: string
          id: string
          includes: string[]
          label: string
          legacy_option_id: string | null
          peak_months: number[]
          price_from_cents: number | null
          price_type: string | null
          season_months: number[]
          sort_order: number
          target_species: string[]
          updated_at: string
        }
        Insert: {
          content_blocks?: Json
          created_at?: string
          currency?: string
          description?: string | null
          excludes?: string[]
          expedition_id: string
          id?: string
          includes?: string[]
          label: string
          legacy_option_id?: string | null
          peak_months?: number[]
          price_from_cents?: number | null
          price_type?: string | null
          season_months?: number[]
          sort_order?: number
          target_species?: string[]
          updated_at?: string
        }
        Update: {
          content_blocks?: Json
          created_at?: string
          currency?: string
          description?: string | null
          excludes?: string[]
          expedition_id?: string
          id?: string
          includes?: string[]
          label?: string
          legacy_option_id?: string | null
          peak_months?: number[]
          price_from_cents?: number | null
          price_type?: string | null
          season_months?: number[]
          sort_order?: number
          target_species?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expedition_options_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
        ]
      }
      expedition_private: {
        Row: {
          access_notes: string | null
          exact_address: string | null
          exact_lat: number | null
          exact_lng: number | null
          expedition_id: string
          lodge_contact: string | null
          lodge_name: string | null
          meeting_point: string | null
          updated_at: string
        }
        Insert: {
          access_notes?: string | null
          exact_address?: string | null
          exact_lat?: number | null
          exact_lng?: number | null
          expedition_id: string
          lodge_contact?: string | null
          lodge_name?: string | null
          meeting_point?: string | null
          updated_at?: string
        }
        Update: {
          access_notes?: string | null
          exact_address?: string | null
          exact_lat?: number | null
          exact_lng?: number | null
          expedition_id?: string
          lodge_contact?: string | null
          lodge_name?: string | null
          meeting_point?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expedition_private_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: true
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
        ]
      }
      expedition_waters: {
        Row: {
          confirmed_at: string | null
          confirmed_by_guide_id: string | null
          created_at: string
          expedition_id: string
          internal_notes: string | null
          is_primary: boolean
          is_public: boolean
          months: number[]
          source: string
          updated_at: string
          water_id: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by_guide_id?: string | null
          created_at?: string
          expedition_id: string
          internal_notes?: string | null
          is_primary?: boolean
          is_public?: boolean
          months?: number[]
          source?: string
          updated_at?: string
          water_id: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by_guide_id?: string | null
          created_at?: string
          expedition_id?: string
          internal_notes?: string | null
          is_primary?: boolean
          is_public?: boolean
          months?: number[]
          source?: string
          updated_at?: string
          water_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expedition_waters_confirmed_by_guide_id_fkey"
            columns: ["confirmed_by_guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedition_waters_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedition_waters_water_id_fkey"
            columns: ["water_id"]
            isOneToOne: false
            referencedRelation: "expedition_waters_public"
            referencedColumns: ["water_id"]
          },
          {
            foreignKeyName: "expedition_waters_water_id_fkey"
            columns: ["water_id"]
            isOneToOne: false
            referencedRelation: "waters"
            referencedColumns: ["id"]
          },
        ]
      }
      expeditions: {
        Row: {
          collection_type: string
          content_blocks: Json
          country_id: string
          created_at: string
          currency: string
          difficulty: string | null
          display_coords: string | null
          environment: string[]
          featured: boolean
          gallery_image_urls: string[]
          hero_image_url: string | null
          id: string
          intro: string | null
          legacy_content: Json
          legacy_page_id: string | null
          legacy_trip_id: string | null
          non_angler_friendly: boolean
          og_image_url: string | null
          peak_months: number[]
          physical_effort: string | null
          price_basis: string | null
          price_confirmed_at: string | null
          price_from_cents: number | null
          price_type: string | null
          region_id: string | null
          season_months: number[]
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["publish_state"]
          subtitle: string | null
          target_species: string[]
          technique: string[]
          title: string
          updated_at: string
          video_urls: string[]
        }
        Insert: {
          collection_type?: string
          content_blocks?: Json
          country_id: string
          created_at?: string
          currency?: string
          difficulty?: string | null
          display_coords?: string | null
          environment?: string[]
          featured?: boolean
          gallery_image_urls?: string[]
          hero_image_url?: string | null
          id?: string
          intro?: string | null
          legacy_content?: Json
          legacy_page_id?: string | null
          legacy_trip_id?: string | null
          non_angler_friendly?: boolean
          og_image_url?: string | null
          peak_months?: number[]
          physical_effort?: string | null
          price_basis?: string | null
          price_confirmed_at?: string | null
          price_from_cents?: number | null
          price_type?: string | null
          region_id?: string | null
          season_months?: number[]
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publish_state"]
          subtitle?: string | null
          target_species?: string[]
          technique?: string[]
          title: string
          updated_at?: string
          video_urls?: string[]
        }
        Update: {
          collection_type?: string
          content_blocks?: Json
          country_id?: string
          created_at?: string
          currency?: string
          difficulty?: string | null
          display_coords?: string | null
          environment?: string[]
          featured?: boolean
          gallery_image_urls?: string[]
          hero_image_url?: string | null
          id?: string
          intro?: string | null
          legacy_content?: Json
          legacy_page_id?: string | null
          legacy_trip_id?: string | null
          non_angler_friendly?: boolean
          og_image_url?: string | null
          peak_months?: number[]
          physical_effort?: string | null
          price_basis?: string | null
          price_confirmed_at?: string | null
          price_from_cents?: number | null
          price_type?: string | null
          region_id?: string | null
          season_months?: number[]
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publish_state"]
          subtitle?: string | null
          target_species?: string[]
          technique?: string[]
          title?: string
          updated_at?: string
          video_urls?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "expeditions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expeditions_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_page_options: {
        Row: {
          boat_description: string | null
          boat_image_url: string | null
          boats: Json | null
          catches_text: string | null
          content_blocks: Json
          created_at: string
          description: string | null
          excludes: string[]
          experience_page_id: string
          id: string
          includes: string[]
          label: string
          location_lat: number | null
          location_lng: number | null
          meeting_point_description: string | null
          meeting_point_name: string | null
          peak_months: number[] | null
          price_from: number
          price_type: string
          season_months: number[] | null
          sort_order: number
          special_attractions: Json
          target_species: string[]
          updated_at: string
          what_to_bring: string[]
        }
        Insert: {
          boat_description?: string | null
          boat_image_url?: string | null
          boats?: Json | null
          catches_text?: string | null
          content_blocks?: Json
          created_at?: string
          description?: string | null
          excludes?: string[]
          experience_page_id: string
          id?: string
          includes?: string[]
          label?: string
          location_lat?: number | null
          location_lng?: number | null
          meeting_point_description?: string | null
          meeting_point_name?: string | null
          peak_months?: number[] | null
          price_from?: number
          price_type?: string
          season_months?: number[] | null
          sort_order?: number
          special_attractions?: Json
          target_species?: string[]
          updated_at?: string
          what_to_bring?: string[]
        }
        Update: {
          boat_description?: string | null
          boat_image_url?: string | null
          boats?: Json | null
          catches_text?: string | null
          content_blocks?: Json
          created_at?: string
          description?: string | null
          excludes?: string[]
          experience_page_id?: string
          id?: string
          includes?: string[]
          label?: string
          location_lat?: number | null
          location_lng?: number | null
          meeting_point_description?: string | null
          meeting_point_name?: string | null
          peak_months?: number[] | null
          price_from?: number
          price_type?: string
          season_months?: number[] | null
          sort_order?: number
          special_attractions?: Json
          target_species?: string[]
          updated_at?: string
          what_to_bring?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "experience_page_options_experience_page_id_fkey"
            columns: ["experience_page_id"]
            isOneToOne: false
            referencedRelation: "experience_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_pages: {
        Row: {
          accommodations: Json
          best_months: string | null
          boat_description: string | null
          boat_image_url: string | null
          boats: Json | null
          catches_text: string | null
          content_blocks: Json
          content_photo_urls: string[]
          country: string
          created_at: string
          currency: string
          difficulty: string | null
          environment: string[]
          excludes: string[]
          experience_name: string
          faq: Json
          gallery_image_urls: string[]
          guide_id: string | null
          hero_image_url: string | null
          id: string
          includes: string[]
          intro_text: string | null
          location_area: Json | null
          location_lat: number | null
          location_lng: number | null
          location_spots: Json | null
          meeting_point_description: string | null
          meeting_point_name: string | null
          meta_description: string | null
          meta_title: string | null
          non_angler_friendly: boolean
          og_image_url: string | null
          peak_months: number[]
          physical_effort: string | null
          price_from: number
          price_type: string
          region: string
          rod_setup: string | null
          season_end: string | null
          season_months: number[]
          season_start: string | null
          slug: string
          special_attraction_image_url: string | null
          special_attraction_text: string | null
          special_attractions: Json
          species_details: Json
          status: string
          story_text: string | null
          target_species: string[]
          technique: string[]
          trip_id: string | null
          updated_at: string
          views_image_urls: string[] | null
          what_to_bring: string[]
        }
        Insert: {
          accommodations?: Json
          best_months?: string | null
          boat_description?: string | null
          boat_image_url?: string | null
          boats?: Json | null
          catches_text?: string | null
          content_blocks?: Json
          content_photo_urls?: string[]
          country: string
          created_at?: string
          currency?: string
          difficulty?: string | null
          environment?: string[]
          excludes?: string[]
          experience_name: string
          faq?: Json
          gallery_image_urls?: string[]
          guide_id?: string | null
          hero_image_url?: string | null
          id?: string
          includes?: string[]
          intro_text?: string | null
          location_area?: Json | null
          location_lat?: number | null
          location_lng?: number | null
          location_spots?: Json | null
          meeting_point_description?: string | null
          meeting_point_name?: string | null
          meta_description?: string | null
          meta_title?: string | null
          non_angler_friendly?: boolean
          og_image_url?: string | null
          peak_months?: number[]
          physical_effort?: string | null
          price_from?: number
          price_type?: string
          region?: string
          rod_setup?: string | null
          season_end?: string | null
          season_months?: number[]
          season_start?: string | null
          slug: string
          special_attraction_image_url?: string | null
          special_attraction_text?: string | null
          special_attractions?: Json
          species_details?: Json
          status?: string
          story_text?: string | null
          target_species?: string[]
          technique?: string[]
          trip_id?: string | null
          updated_at?: string
          views_image_urls?: string[] | null
          what_to_bring?: string[]
        }
        Update: {
          accommodations?: Json
          best_months?: string | null
          boat_description?: string | null
          boat_image_url?: string | null
          boats?: Json | null
          catches_text?: string | null
          content_blocks?: Json
          content_photo_urls?: string[]
          country?: string
          created_at?: string
          currency?: string
          difficulty?: string | null
          environment?: string[]
          excludes?: string[]
          experience_name?: string
          faq?: Json
          gallery_image_urls?: string[]
          guide_id?: string | null
          hero_image_url?: string | null
          id?: string
          includes?: string[]
          intro_text?: string | null
          location_area?: Json | null
          location_lat?: number | null
          location_lng?: number | null
          location_spots?: Json | null
          meeting_point_description?: string | null
          meeting_point_name?: string | null
          meta_description?: string | null
          meta_title?: string | null
          non_angler_friendly?: boolean
          og_image_url?: string | null
          peak_months?: number[]
          physical_effort?: string | null
          price_from?: number
          price_type?: string
          region?: string
          rod_setup?: string | null
          season_end?: string | null
          season_months?: number[]
          season_start?: string | null
          slug?: string
          special_attraction_image_url?: string | null
          special_attraction_text?: string | null
          special_attractions?: Json
          species_details?: Json
          status?: string
          story_text?: string | null
          target_species?: string[]
          technique?: string[]
          trip_id?: string | null
          updated_at?: string
          views_image_urls?: string[] | null
          what_to_bring?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "experience_pages_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      fixed_costs: {
        Row: {
          active: boolean
          amount_pln: number
          billing_cycle: string
          category: string
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_pln: number
          billing_cycle?: string
          category?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_pln?: number
          billing_cycle?: string
          category?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guide_availability: {
        Row: {
          created_at: string
          end_date: string
          guide_id: string
          id: string
          note: string | null
          start_date: string
          state: string
        }
        Insert: {
          created_at?: string
          end_date: string
          guide_id: string
          id?: string
          note?: string | null
          start_date: string
          state?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          guide_id?: string
          id?: string
          note?: string | null
          start_date?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_availability_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_images: {
        Row: {
          created_at: string
          guide_id: string
          id: string
          is_cover: boolean
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          guide_id: string
          id?: string
          is_cover?: boolean
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          guide_id?: string
          id?: string
          is_cover?: boolean
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_images_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_intake_forms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          questions: Json
          title: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          questions?: Json
          title: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          questions?: Json
          title?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      guide_intake_responses: {
        Row: {
          answers: Json
          form_id: string
          id: string
          respondent_email: string
          respondent_name: string
          submitted_at: string
        }
        Insert: {
          answers?: Json
          form_id: string
          id?: string
          respondent_email: string
          respondent_name: string
          submitted_at?: string
        }
        Update: {
          answers?: Json
          form_id?: string
          id?: string
          respondent_email?: string
          respondent_name?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_intake_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "guide_intake_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_intake_submissions: {
        Row: {
          access_rights: string | null
          additional_notes: string | null
          created_at: string
          external_media_link: string | null
          fishing_technique: string | null
          guide_id: string
          id: string
          photo_urls: string[]
          reviewed_by_admin: boolean
          submitted_at: string | null
          token: string
          updated_at: string
          video_urls: string[]
          what_you_do: string | null
        }
        Insert: {
          access_rights?: string | null
          additional_notes?: string | null
          created_at?: string
          external_media_link?: string | null
          fishing_technique?: string | null
          guide_id: string
          id?: string
          photo_urls?: string[]
          reviewed_by_admin?: boolean
          submitted_at?: string | null
          token: string
          updated_at?: string
          video_urls?: string[]
          what_you_do?: string | null
        }
        Update: {
          access_rights?: string | null
          additional_notes?: string | null
          created_at?: string
          external_media_link?: string | null
          fishing_technique?: string | null
          guide_id?: string
          id?: string
          photo_urls?: string[]
          reviewed_by_admin?: boolean
          submitted_at?: string | null
          token?: string
          updated_at?: string
          video_urls?: string[]
          what_you_do?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guide_intake_submissions_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: true
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_photos: {
        Row: {
          caption: string | null
          created_at: string
          guide_id: string
          id: string
          is_cover: boolean
          sort_order: number
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          guide_id: string
          id?: string
          is_cover?: boolean
          sort_order?: number
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          guide_id?: string
          id?: string
          is_cover?: boolean
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_photos_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_private: {
        Row: {
          email: string | null
          guide_id: string
          iban: string | null
          iban_bank_name: string | null
          iban_bic: string | null
          iban_holder_name: string | null
          internal_notes: string | null
          invite_email: string | null
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          email?: string | null
          guide_id: string
          iban?: string | null
          iban_bank_name?: string | null
          iban_bic?: string | null
          iban_holder_name?: string | null
          internal_notes?: string | null
          invite_email?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          email?: string | null
          guide_id?: string
          iban?: string | null
          iban_bank_name?: string | null
          iban_bic?: string | null
          iban_holder_name?: string | null
          internal_notes?: string | null
          invite_email?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guide_private_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: true
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_submissions: {
        Row: {
          country: string
          created_at: string
          experience_id: string | null
          fa_notes: string | null
          fishing_methods: string[] | null
          guide_id: string
          id: string
          includes: string[] | null
          includes_notes: string | null
          location_name: string
          max_anglers: number | null
          personal_note: string | null
          price_approx_eur: number | null
          region: string | null
          season_months: number[] | null
          species: string[]
          status: string
          trip_types: string[] | null
          updated_at: string
        }
        Insert: {
          country: string
          created_at?: string
          experience_id?: string | null
          fa_notes?: string | null
          fishing_methods?: string[] | null
          guide_id: string
          id?: string
          includes?: string[] | null
          includes_notes?: string | null
          location_name: string
          max_anglers?: number | null
          personal_note?: string | null
          price_approx_eur?: number | null
          region?: string | null
          season_months?: number[] | null
          species?: string[]
          status?: string
          trip_types?: string[] | null
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          experience_id?: string | null
          fa_notes?: string | null
          fishing_methods?: string[] | null
          guide_id?: string
          id?: string
          includes?: string[] | null
          includes_notes?: string | null
          location_name?: string
          max_anglers?: number | null
          personal_note?: string | null
          price_approx_eur?: number | null
          region?: string | null
          season_months?: number[] | null
          species?: string[]
          status?: string
          trip_types?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_submissions_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experience_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_submissions_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_unavailable_dates: {
        Row: {
          date: string
          guide_id: string
        }
        Insert: {
          date: string
          guide_id: string
        }
        Update: {
          date?: string
          guide_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_available_dates_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guides: {
        Row: {
          accepted_payment_methods: string[] | null
          avatar_url: string | null
          average_rating: number | null
          bio: string | null
          boat_capacity: number | null
          boat_engine: string | null
          boat_length_m: number | null
          boat_name: string | null
          boat_type: string | null
          calendar_disabled: boolean
          calendar_mode: string
          cancellation_policy: string
          certifications: string[] | null
          city: string | null
          commission_rate: number
          country: string
          cover_url: string | null
          created_at: string
          default_balance_payment_method: string
          external_reviews: Json | null
          facebook_url: string | null
          fish_expertise: string[]
          founding_guide_until: string | null
          full_name: string
          google_profile_url: string | null
          google_rating: number | null
          google_review_count: number | null
          iban: string | null
          iban_bank_name: string | null
          iban_bic: string | null
          iban_holder_name: string | null
          id: string
          instagram_url: string | null
          invite_email: string | null
          is_beta_listing: boolean
          is_hidden: boolean
          landscape_url: string | null
          languages: string[]
          payment_ready: boolean | null
          photo_marketing_consent: boolean
          pricing_model: Database["public"]["Enums"]["pricing_model"]
          slug: string | null
          specialties: string[] | null
          status: Database["public"]["Enums"]["guide_status"]
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_payouts_enabled: boolean
          tagline: string | null
          terms_accepted_at: string | null
          total_reviews: number
          updated_at: string
          user_id: string | null
          verified_at: string | null
          website_url: string | null
          years_experience: number | null
          youtube_url: string | null
        }
        Insert: {
          accepted_payment_methods?: string[] | null
          avatar_url?: string | null
          average_rating?: number | null
          bio?: string | null
          boat_capacity?: number | null
          boat_engine?: string | null
          boat_length_m?: number | null
          boat_name?: string | null
          boat_type?: string | null
          calendar_disabled?: boolean
          calendar_mode?: string
          cancellation_policy?: string
          certifications?: string[] | null
          city?: string | null
          commission_rate?: number
          country: string
          cover_url?: string | null
          created_at?: string
          default_balance_payment_method?: string
          external_reviews?: Json | null
          facebook_url?: string | null
          fish_expertise?: string[]
          founding_guide_until?: string | null
          full_name: string
          google_profile_url?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          iban?: string | null
          iban_bank_name?: string | null
          iban_bic?: string | null
          iban_holder_name?: string | null
          id?: string
          instagram_url?: string | null
          invite_email?: string | null
          is_beta_listing?: boolean
          is_hidden?: boolean
          landscape_url?: string | null
          languages?: string[]
          payment_ready?: boolean | null
          photo_marketing_consent?: boolean
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          slug?: string | null
          specialties?: string[] | null
          status?: Database["public"]["Enums"]["guide_status"]
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          tagline?: string | null
          terms_accepted_at?: string | null
          total_reviews?: number
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
          website_url?: string | null
          years_experience?: number | null
          youtube_url?: string | null
        }
        Update: {
          accepted_payment_methods?: string[] | null
          avatar_url?: string | null
          average_rating?: number | null
          bio?: string | null
          boat_capacity?: number | null
          boat_engine?: string | null
          boat_length_m?: number | null
          boat_name?: string | null
          boat_type?: string | null
          calendar_disabled?: boolean
          calendar_mode?: string
          cancellation_policy?: string
          certifications?: string[] | null
          city?: string | null
          commission_rate?: number
          country?: string
          cover_url?: string | null
          created_at?: string
          default_balance_payment_method?: string
          external_reviews?: Json | null
          facebook_url?: string | null
          fish_expertise?: string[]
          founding_guide_until?: string | null
          full_name?: string
          google_profile_url?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          iban?: string | null
          iban_bank_name?: string | null
          iban_bic?: string | null
          iban_holder_name?: string | null
          id?: string
          instagram_url?: string | null
          invite_email?: string | null
          is_beta_listing?: boolean
          is_hidden?: boolean
          landscape_url?: string | null
          languages?: string[]
          payment_ready?: boolean | null
          photo_marketing_consent?: boolean
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          slug?: string | null
          specialties?: string[] | null
          status?: Database["public"]["Enums"]["guide_status"]
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          tagline?: string | null
          terms_accepted_at?: string | null
          total_reviews?: number
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
          website_url?: string | null
          years_experience?: number | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          agent_round: number
          agent_status: string | null
          angler_country: string | null
          angler_email: string
          angler_name: string
          angler_phone: string | null
          assigned_at: string | null
          assigned_guide_id: string | null
          created_at: string
          deal_currency: string
          deposit_amount: number | null
          deposit_paid_at: string | null
          deposit_stripe_session_id: string | null
          email_thread_message_id: string | null
          experience_page_id: string | null
          external_offer_sent: boolean
          fa_notes: string | null
          gclid: string | null
          guide_acceptance: string | null
          guide_decline_reason: string | null
          guide_id: string | null
          guide_offer_eta: string | null
          guide_responded_at: string | null
          id: string
          internal_commission_eur: number | null
          internal_deal_total_eur: number | null
          internal_notes: string | null
          last_contact_at: string | null
          lost_reason: string | null
          message: string | null
          next_action: string | null
          offer_answers: Json
          offer_deposit_eur: number | null
          offer_inclusions: Json
          offer_license_heading: string | null
          offer_license_info: string | null
          offer_location: string | null
          offer_location_geojson: Json | null
          offer_location_lat: number | null
          offer_location_lng: number | null
          offer_location_zoom: number | null
          offer_notes: string | null
          offer_options: Json | null
          offer_photos: Json
          offer_questions: Json
          offer_refund_reason: string | null
          offer_schedule: Json
          offer_sent_at: string | null
          offer_token: string | null
          offer_token_expires_at: string | null
          offer_total_eur: number | null
          offer_trip_plan: string | null
          offer_what_to_bring: Json
          party_size: number
          priority: string | null
          requested_dates: string[] | null
          selected_option: string | null
          selected_option_id: string | null
          source: string | null
          stage_reached: string
          status: string
          trip_country: string | null
          trip_id: string | null
          trip_length: string | null
          trip_type: string | null
          updated_at: string
          utm: Json | null
        }
        Insert: {
          agent_round?: number
          agent_status?: string | null
          angler_country?: string | null
          angler_email: string
          angler_name: string
          angler_phone?: string | null
          assigned_at?: string | null
          assigned_guide_id?: string | null
          created_at?: string
          deal_currency?: string
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          deposit_stripe_session_id?: string | null
          email_thread_message_id?: string | null
          experience_page_id?: string | null
          external_offer_sent?: boolean
          fa_notes?: string | null
          gclid?: string | null
          guide_acceptance?: string | null
          guide_decline_reason?: string | null
          guide_id?: string | null
          guide_offer_eta?: string | null
          guide_responded_at?: string | null
          id?: string
          internal_commission_eur?: number | null
          internal_deal_total_eur?: number | null
          internal_notes?: string | null
          last_contact_at?: string | null
          lost_reason?: string | null
          message?: string | null
          next_action?: string | null
          offer_answers?: Json
          offer_deposit_eur?: number | null
          offer_inclusions?: Json
          offer_license_heading?: string | null
          offer_license_info?: string | null
          offer_location?: string | null
          offer_location_geojson?: Json | null
          offer_location_lat?: number | null
          offer_location_lng?: number | null
          offer_location_zoom?: number | null
          offer_notes?: string | null
          offer_options?: Json | null
          offer_photos?: Json
          offer_questions?: Json
          offer_refund_reason?: string | null
          offer_schedule?: Json
          offer_sent_at?: string | null
          offer_token?: string | null
          offer_token_expires_at?: string | null
          offer_total_eur?: number | null
          offer_trip_plan?: string | null
          offer_what_to_bring?: Json
          party_size?: number
          priority?: string | null
          requested_dates?: string[] | null
          selected_option?: string | null
          selected_option_id?: string | null
          source?: string | null
          stage_reached?: string
          status?: string
          trip_country?: string | null
          trip_id?: string | null
          trip_length?: string | null
          trip_type?: string | null
          updated_at?: string
          utm?: Json | null
        }
        Update: {
          agent_round?: number
          agent_status?: string | null
          angler_country?: string | null
          angler_email?: string
          angler_name?: string
          angler_phone?: string | null
          assigned_at?: string | null
          assigned_guide_id?: string | null
          created_at?: string
          deal_currency?: string
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          deposit_stripe_session_id?: string | null
          email_thread_message_id?: string | null
          experience_page_id?: string | null
          external_offer_sent?: boolean
          fa_notes?: string | null
          gclid?: string | null
          guide_acceptance?: string | null
          guide_decline_reason?: string | null
          guide_id?: string | null
          guide_offer_eta?: string | null
          guide_responded_at?: string | null
          id?: string
          internal_commission_eur?: number | null
          internal_deal_total_eur?: number | null
          internal_notes?: string | null
          last_contact_at?: string | null
          lost_reason?: string | null
          message?: string | null
          next_action?: string | null
          offer_answers?: Json
          offer_deposit_eur?: number | null
          offer_inclusions?: Json
          offer_license_heading?: string | null
          offer_license_info?: string | null
          offer_location?: string | null
          offer_location_geojson?: Json | null
          offer_location_lat?: number | null
          offer_location_lng?: number | null
          offer_location_zoom?: number | null
          offer_notes?: string | null
          offer_options?: Json | null
          offer_photos?: Json
          offer_questions?: Json
          offer_refund_reason?: string | null
          offer_schedule?: Json
          offer_sent_at?: string | null
          offer_token?: string | null
          offer_token_expires_at?: string | null
          offer_total_eur?: number | null
          offer_trip_plan?: string | null
          offer_what_to_bring?: Json
          party_size?: number
          priority?: string | null
          requested_dates?: string[] | null
          selected_option?: string | null
          selected_option_id?: string | null
          source?: string | null
          stage_reached?: string
          status?: string
          trip_country?: string | null
          trip_id?: string | null
          trip_length?: string | null
          trip_type?: string | null
          updated_at?: string
          utm?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_assigned_guide_id_fkey"
            columns: ["assigned_guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_experience_page_id_fkey"
            columns: ["experience_page_id"]
            isOneToOne: false
            referencedRelation: "experience_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_messages: {
        Row: {
          body: string
          id: string
          inquiry_id: string
          sent_at: string | null
          subject: string | null
        }
        Insert: {
          body: string
          id?: string
          inquiry_id: string
          sent_at?: string | null
          subject?: string | null
        }
        Update: {
          body?: string
          id?: string
          inquiry_id?: string
          sent_at?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_messages_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_todos: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string | null
          id: string
          input_label: string | null
          input_value: string | null
          inquiry_id: string
          sort_order: number
          title: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string | null
          id?: string
          input_label?: string | null
          input_value?: string | null
          inquiry_id: string
          sort_order?: number
          title: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string | null
          id?: string
          input_label?: string | null
          input_value?: string | null
          inquiry_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_todos_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_trip_details: {
        Row: {
          accommodation: string | null
          confirmed_date: string | null
          confirmed_party_size: number | null
          date_flexibility: string | null
          guide_final_dates: string | null
          guide_notes: string | null
          guide_options: Json
          inquiry_id: string
          price_range: string | null
          target_species: string | null
          updated_at: string | null
        }
        Insert: {
          accommodation?: string | null
          confirmed_date?: string | null
          confirmed_party_size?: number | null
          date_flexibility?: string | null
          guide_final_dates?: string | null
          guide_notes?: string | null
          guide_options?: Json
          inquiry_id: string
          price_range?: string | null
          target_species?: string | null
          updated_at?: string | null
        }
        Update: {
          accommodation?: string | null
          confirmed_date?: string | null
          confirmed_party_size?: number | null
          date_flexibility?: string | null
          guide_final_dates?: string | null
          guide_notes?: string | null
          guide_options?: Json
          inquiry_id?: string
          price_range?: string | null
          target_species?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_trip_details_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: true
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_messages: {
        Row: {
          channel: string
          contact_name: string
          contact_type: string
          content: string
          created_at: string
          created_by: string
          direction: string
          id: string
          inquiry_id: string
        }
        Insert: {
          channel: string
          contact_name?: string
          contact_type: string
          content: string
          created_at?: string
          created_by?: string
          direction: string
          id?: string
          inquiry_id: string
        }
        Update: {
          channel?: string
          contact_name?: string
          contact_type?: string
          content?: string
          created_at?: string
          created_by?: string
          direction?: string
          id?: string
          inquiry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_messages_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_cost_entries: {
        Row: {
          amount_pln: number
          category: string
          created_at: string
          id: string
          month: string
          name: string
          notes: string | null
        }
        Insert: {
          amount_pln: number
          category?: string
          created_at?: string
          id?: string
          month: string
          name: string
          notes?: string | null
        }
        Update: {
          amount_pln?: number
          category?: string
          created_at?: string
          id?: string
          month?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      media: {
        Row: {
          alt: string | null
          caption: string | null
          created_at: string
          credit: string | null
          focal_x: number | null
          focal_y: number | null
          height: number | null
          id: string
          lqip: string | null
          public_url: string | null
          storage_path: string
          taken_at: string | null
          width: number | null
        }
        Insert: {
          alt?: string | null
          caption?: string | null
          created_at?: string
          credit?: string | null
          focal_x?: number | null
          focal_y?: number | null
          height?: number | null
          id?: string
          lqip?: string | null
          public_url?: string | null
          storage_path: string
          taken_at?: string | null
          width?: number | null
        }
        Update: {
          alt?: string | null
          caption?: string | null
          created_at?: string
          credit?: string | null
          focal_x?: number | null
          focal_y?: number | null
          height?: number | null
          id?: string
          lqip?: string | null
          public_url?: string | null
          storage_path?: string
          taken_at?: string | null
          width?: number | null
        }
        Relationships: []
      }
      media_links: {
        Row: {
          entity_id: string
          entity_type: Database["public"]["Enums"]["media_entity"]
          id: string
          media_id: string
          role: Database["public"]["Enums"]["media_role"]
          sort_order: number
        }
        Insert: {
          entity_id: string
          entity_type: Database["public"]["Enums"]["media_entity"]
          id?: string
          media_id: string
          role?: Database["public"]["Enums"]["media_role"]
          sort_order?: number
        }
        Update: {
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["media_entity"]
          id?: string
          media_id?: string
          role?: Database["public"]["Enums"]["media_role"]
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_links_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          accepted_at: string | null
          anglers: number | null
          cancellation_terms: string | null
          commission_cents: number | null
          content: Json
          created_at: string
          currency: string
          deposit_cents: number | null
          deposit_paid_at: string | null
          deposit_pct: number | null
          end_date: string | null
          expedition_id: string | null
          expires_at: string | null
          guide_id: string | null
          guide_payout_cents: number | null
          id: string
          legacy_inquiry_id: string | null
          location_released_at: string | null
          notes: string | null
          public_token: string | null
          refund_reason: string | null
          request_id: string
          sent_at: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["offer_state"]
          stripe_session_id: string | null
          terms: string | null
          token_expires_at: string | null
          total_cents: number | null
          updated_at: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          anglers?: number | null
          cancellation_terms?: string | null
          commission_cents?: number | null
          content?: Json
          created_at?: string
          currency?: string
          deposit_cents?: number | null
          deposit_paid_at?: string | null
          deposit_pct?: number | null
          end_date?: string | null
          expedition_id?: string | null
          expires_at?: string | null
          guide_id?: string | null
          guide_payout_cents?: number | null
          id?: string
          legacy_inquiry_id?: string | null
          location_released_at?: string | null
          notes?: string | null
          public_token?: string | null
          refund_reason?: string | null
          request_id: string
          sent_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["offer_state"]
          stripe_session_id?: string | null
          terms?: string | null
          token_expires_at?: string | null
          total_cents?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          accepted_at?: string | null
          anglers?: number | null
          cancellation_terms?: string | null
          commission_cents?: number | null
          content?: Json
          created_at?: string
          currency?: string
          deposit_cents?: number | null
          deposit_paid_at?: string | null
          deposit_pct?: number | null
          end_date?: string | null
          expedition_id?: string | null
          expires_at?: string | null
          guide_id?: string | null
          guide_payout_cents?: number | null
          id?: string
          legacy_inquiry_id?: string | null
          location_released_at?: string | null
          notes?: string | null
          public_token?: string | null
          refund_reason?: string | null
          request_id?: string
          sent_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["offer_state"]
          stripe_session_id?: string | null
          terms?: string | null
          token_expires_at?: string | null
          total_cents?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "offers_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      regions: {
        Row: {
          country_id: string
          created_at: string
          id: string
          intro: string | null
          name: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["publish_state"]
          updated_at: string
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          intro?: string | null
          name: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publish_state"]
          updated_at?: string
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          intro?: string | null
          name?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publish_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      request_guides: {
        Row: {
          asked_at: string
          decline_reason: string | null
          guide_currency: string | null
          guide_id: string
          guide_price_cents: number | null
          id: string
          note: string | null
          offer_eta: string | null
          request_id: string
          responded_at: string | null
          state: Database["public"]["Enums"]["assign_state"]
        }
        Insert: {
          asked_at?: string
          decline_reason?: string | null
          guide_currency?: string | null
          guide_id: string
          guide_price_cents?: number | null
          id?: string
          note?: string | null
          offer_eta?: string | null
          request_id: string
          responded_at?: string | null
          state?: Database["public"]["Enums"]["assign_state"]
        }
        Update: {
          asked_at?: string
          decline_reason?: string | null
          guide_currency?: string | null
          guide_id?: string
          guide_price_cents?: number | null
          id?: string
          note?: string | null
          offer_eta?: string | null
          request_id?: string
          responded_at?: string | null
          state?: Database["public"]["Enums"]["assign_state"]
        }
        Relationships: [
          {
            foreignKeyName: "request_guides_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_guides_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          accommodation: string | null
          agent_round: number | null
          agent_status: string | null
          assigned_at: string | null
          assigned_guide_id: string | null
          client_country: string | null
          client_email: string
          client_name: string
          client_phone: string | null
          country_id: string | null
          created_at: string
          dates_flexible: boolean
          email_thread_message_id: string | null
          expedition_id: string | null
          expedition_option_id: string | null
          id: string
          internal_notes: string | null
          last_contact_at: string | null
          legacy_inquiry_id: string | null
          legacy_status: string | null
          lost_reason: string | null
          message: string | null
          next_action: string | null
          party_size: number | null
          preferred_end: string | null
          preferred_start: string | null
          price_range: string | null
          priority: string | null
          reference: string
          requested_dates_raw: string[]
          stage_reached: string | null
          status: Database["public"]["Enums"]["req_state"]
          target_species: string | null
          updated_at: string
        }
        Insert: {
          accommodation?: string | null
          agent_round?: number | null
          agent_status?: string | null
          assigned_at?: string | null
          assigned_guide_id?: string | null
          client_country?: string | null
          client_email: string
          client_name: string
          client_phone?: string | null
          country_id?: string | null
          created_at?: string
          dates_flexible?: boolean
          email_thread_message_id?: string | null
          expedition_id?: string | null
          expedition_option_id?: string | null
          id?: string
          internal_notes?: string | null
          last_contact_at?: string | null
          legacy_inquiry_id?: string | null
          legacy_status?: string | null
          lost_reason?: string | null
          message?: string | null
          next_action?: string | null
          party_size?: number | null
          preferred_end?: string | null
          preferred_start?: string | null
          price_range?: string | null
          priority?: string | null
          reference?: string
          requested_dates_raw?: string[]
          stage_reached?: string | null
          status?: Database["public"]["Enums"]["req_state"]
          target_species?: string | null
          updated_at?: string
        }
        Update: {
          accommodation?: string | null
          agent_round?: number | null
          agent_status?: string | null
          assigned_at?: string | null
          assigned_guide_id?: string | null
          client_country?: string | null
          client_email?: string
          client_name?: string
          client_phone?: string | null
          country_id?: string | null
          created_at?: string
          dates_flexible?: boolean
          email_thread_message_id?: string | null
          expedition_id?: string | null
          expedition_option_id?: string | null
          id?: string
          internal_notes?: string | null
          last_contact_at?: string | null
          legacy_inquiry_id?: string | null
          legacy_status?: string | null
          lost_reason?: string | null
          message?: string | null
          next_action?: string | null
          party_size?: number | null
          preferred_end?: string | null
          preferred_start?: string | null
          price_range?: string | null
          priority?: string | null
          reference?: string
          requested_dates_raw?: string[]
          stage_reached?: string | null
          status?: Database["public"]["Enums"]["req_state"]
          target_species?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_assigned_guide_id_fkey"
            columns: ["assigned_guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_expedition_option_id_fkey"
            columns: ["expedition_option_id"]
            isOneToOne: false
            referencedRelation: "expedition_options"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          inquiry_id: string
          media_urls: Json | null
          overall_rating: number | null
          submitted_at: string | null
          token: string
          token_expires_at: string
          trip_description: string | null
          would_recommend: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          inquiry_id: string
          media_urls?: Json | null
          overall_rating?: number | null
          submitted_at?: string | null
          token: string
          token_expires_at?: string
          trip_description?: string | null
          would_recommend?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          inquiry_id?: string
          media_urls?: Json | null
          overall_rating?: number | null
          submitted_at?: string | null
          token?: string
          token_expires_at?: string
          trip_description?: string | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      species_windows: {
        Row: {
          cr_policy: string | null
          created_at: string
          expedition_id: string
          method_note: string | null
          peak_months: number[]
          season_months: number[]
          sort_order: number
          species: string
          typical_size_note: string | null
          updated_at: string
        }
        Insert: {
          cr_policy?: string | null
          created_at?: string
          expedition_id: string
          method_note?: string | null
          peak_months?: number[]
          season_months?: number[]
          sort_order?: number
          species: string
          typical_size_note?: string | null
          updated_at?: string
        }
        Update: {
          cr_policy?: string | null
          created_at?: string
          expedition_id?: string
          method_note?: string | null
          peak_months?: number[]
          season_months?: number[]
          sort_order?: number
          species?: string
          typical_size_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "species_windows_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
        ]
      }
      unmatched_messages: {
        Row: {
          content: string
          created_at: string
          from_identifier: string
          id: string
          matched_at: string | null
          matched_by: string | null
          matched_inquiry_id: string | null
          raw_payload: Json | null
          sender_name: string
          source: string
        }
        Insert: {
          content: string
          created_at?: string
          from_identifier: string
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_inquiry_id?: string | null
          raw_payload?: Json | null
          sender_name?: string
          source: string
        }
        Update: {
          content?: string
          created_at?: string
          from_identifier?: string
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_inquiry_id?: string | null
          raw_payload?: Json | null
          sender_name?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "unmatched_messages_matched_inquiry_id_fkey"
            columns: ["matched_inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      waters: {
        Row: {
          access_type: string
          centroid_lat: number | null
          centroid_lng: number | null
          country_id: string
          created_at: string
          id: string
          internal_notes: string | null
          licence_authority: string | null
          name: string
          name_local: string | null
          region_id: string | null
          updated_at: string
          water_type: string | null
        }
        Insert: {
          access_type?: string
          centroid_lat?: number | null
          centroid_lng?: number | null
          country_id: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          licence_authority?: string | null
          name: string
          name_local?: string | null
          region_id?: string | null
          updated_at?: string
          water_type?: string | null
        }
        Update: {
          access_type?: string
          centroid_lat?: number | null
          centroid_lng?: number | null
          country_id?: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          licence_authority?: string | null
          name?: string
          name_local?: string | null
          region_id?: string | null
          updated_at?: string
          water_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waters_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waters_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      expedition_waters_public: {
        Row: {
          expedition_id: string | null
          is_primary: boolean | null
          months: number[] | null
          name: string | null
          name_local: string | null
          region_id: string | null
          water_id: string | null
          water_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expedition_waters_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waters_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      column_fill: {
        Args: { p_schema: string; p_table: string }
        Returns: {
          col: string
          filled: number
          pct: number
        }[]
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_licenses_for_point: {
        Args: { lat: number; lng: number }
        Returns: {
          country: string
          currency: string
          license_id: string
          license_name: string
          price_from: number
          purchase_url: string
          season_end: string
          season_start: string
          species: string[]
          zone_id: string
          zone_name: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      import_license_zone: {
        Args: {
          p_country: string
          p_geojson: string
          p_name: string
          p_region: string
          p_river_system: string
          p_source_url?: string
        }
        Returns: string
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      search_trips_near: {
        Args: {
          filter_species?: string
          filter_technique?: string
          lat: number
          lng: number
          radius_km?: number
        }
        Returns: {
          currency: string
          distance_km: number
          guide_id: string
          guide_name: string
          location_name: string
          price_from: number
          species: string[]
          techniques: string[]
          trip_id: string
          trip_title: string
        }[]
      }
      slugify: { Args: { txt: string }; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      assign_state: "pending" | "accepted" | "declined" | "withdrawn"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "refunded"
        | "accepted"
        | "declined"
        | "reviewing"
        | "offer_sent"
        | "offer_accepted"
      guide_status: "pending" | "verified" | "active" | "suspended"
      media_entity: "country" | "region" | "expedition" | "guide"
      media_role: "hero" | "card" | "gallery" | "portrait"
      offer_state:
        | "draft"
        | "sent"
        | "accepted"
        | "declined"
        | "expired"
        | "cancelled"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      pricing_model: "flat_fee" | "commission"
      publish_state: "draft" | "published" | "archived"
      req_state:
        | "new"
        | "reviewing"
        | "guide_outreach"
        | "offer_sent"
        | "deposit_pending"
        | "confirmed"
        | "completed"
        | "lost"
      trip_inquiry_status:
        | "inquiry"
        | "reviewing"
        | "offer_sent"
        | "offer_accepted"
        | "confirmed"
        | "completed"
        | "cancelled"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      assign_state: ["pending", "accepted", "declined", "withdrawn"],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "refunded",
        "accepted",
        "declined",
        "reviewing",
        "offer_sent",
        "offer_accepted",
      ],
      guide_status: ["pending", "verified", "active", "suspended"],
      media_entity: ["country", "region", "expedition", "guide"],
      media_role: ["hero", "card", "gallery", "portrait"],
      offer_state: [
        "draft",
        "sent",
        "accepted",
        "declined",
        "expired",
        "cancelled",
      ],
      payment_status: ["pending", "paid", "failed", "refunded"],
      pricing_model: ["flat_fee", "commission"],
      publish_state: ["draft", "published", "archived"],
      req_state: [
        "new",
        "reviewing",
        "guide_outreach",
        "offer_sent",
        "deposit_pending",
        "confirmed",
        "completed",
        "lost",
      ],
      trip_inquiry_status: [
        "inquiry",
        "reviewing",
        "offer_sent",
        "offer_accepted",
        "confirmed",
        "completed",
        "cancelled",
      ],
    },
  },
} as const

