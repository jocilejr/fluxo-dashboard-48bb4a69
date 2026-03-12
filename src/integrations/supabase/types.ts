export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      abandoned_events: {
        Row: {
          amount: number | null
          created_at: string
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          error_message: string | null
          event_type: string
          funnel_stage: string | null
          id: string
          metadata: Json | null
          normalized_phone: string | null
          product_name: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          error_message?: string | null
          event_type?: string
          funnel_stage?: string | null
          id?: string
          metadata?: Json | null
          normalized_phone?: string | null
          product_name?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          error_message?: string | null
          event_type?: string
          funnel_stage?: string | null
          id?: string
          metadata?: Json | null
          normalized_phone?: string | null
          product_name?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      abandoned_recovery_settings: {
        Row: {
          created_at: string
          id: string
          message: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          updated_at?: string
        }
        Relationships: []
      }
      boleto_recovery_contacts: {
        Row: {
          contact_method: string
          contacted_at: string
          created_at: string
          id: string
          notes: string | null
          rule_id: string | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          contact_method?: string
          contacted_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          rule_id?: string | null
          transaction_id: string
          user_id: string
        }
        Update: {
          contact_method?: string
          contacted_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          rule_id?: string | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boleto_recovery_contacts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "boleto_recovery_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boleto_recovery_contacts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      boleto_recovery_rules: {
        Row: {
          created_at: string
          days: number
          id: string
          is_active: boolean
          message: string
          name: string
          priority: number
          rule_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days: number
          id?: string
          is_active?: boolean
          message: string
          name: string
          priority?: number
          rule_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days?: number
          id?: string
          is_active?: boolean
          message?: string
          name?: string
          priority?: number
          rule_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      boleto_recovery_templates: {
        Row: {
          blocks: Json
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      boleto_settings: {
        Row: {
          created_at: string
          default_expiration_days: number
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_expiration_days?: number
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_expiration_days?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      browser_sessions: {
        Row: {
          created_at: string
          favicon: string | null
          id: string
          is_pinned: boolean
          last_accessed_at: string
          sort_order: number
          title: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favicon?: string | null
          id?: string
          is_pinned?: boolean
          last_accessed_at?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          favicon?: string | null
          id?: string
          is_pinned?: boolean
          last_accessed_at?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          display_phone: string | null
          document: string | null
          email: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          name: string | null
          normalized_phone: string
          pix_payment_count: number
          total_abandoned_events: number
          total_paid: number
          total_pending: number
          total_transactions: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_phone?: string | null
          document?: string | null
          email?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          name?: string | null
          normalized_phone: string
          pix_payment_count?: number
          total_abandoned_events?: number
          total_paid?: number
          total_pending?: number
          total_transactions?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_phone?: string | null
          document?: string | null
          email?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          name?: string | null
          normalized_phone?: string
          pix_payment_count?: number
          total_abandoned_events?: number
          total_paid?: number
          total_pending?: number
          total_transactions?: number
          updated_at?: string
        }
        Relationships: []
      }
      daily_prayers: {
        Row: {
          created_at: string
          day_number: number
          id: string
          text: string
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          text: string
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          text?: string
        }
        Relationships: []
      }
      delivery_accesses: {
        Row: {
          accessed_at: string
          created_at: string
          id: string
          phone: string
          pixel_fired: boolean | null
          product_id: string
          webhook_sent: boolean | null
        }
        Insert: {
          accessed_at?: string
          created_at?: string
          id?: string
          phone: string
          pixel_fired?: boolean | null
          product_id: string
          webhook_sent?: boolean | null
        }
        Update: {
          accessed_at?: string
          created_at?: string
          id?: string
          phone?: string
          pixel_fired?: boolean | null
          product_id?: string
          webhook_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_accesses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_link_generations: {
        Row: {
          created_at: string
          id: string
          normalized_phone: string
          payment_method: string
          phone: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_phone: string
          payment_method: string
          phone: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          normalized_phone?: string
          payment_method?: string
          phone?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_link_generations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_pixels: {
        Row: {
          access_token: string | null
          created_at: string
          event_name: string | null
          id: string
          is_active: boolean | null
          pixel_id: string
          platform: string
          product_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          event_name?: string | null
          id?: string
          is_active?: boolean | null
          pixel_id: string
          platform: string
          product_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          event_name?: string | null
          id?: string
          is_active?: boolean | null
          pixel_id?: string
          platform?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_pixels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_products: {
        Row: {
          created_at: string
          delivery_webhook_url: string | null
          id: string
          is_active: boolean | null
          member_cover_image: string | null
          member_description: string | null
          name: string
          page_logo: string | null
          page_message: string | null
          page_title: string | null
          redirect_delay: number | null
          redirect_url: string | null
          slug: string
          updated_at: string
          value: number | null
          whatsapp_message: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          delivery_webhook_url?: string | null
          id?: string
          is_active?: boolean | null
          member_cover_image?: string | null
          member_description?: string | null
          name: string
          page_logo?: string | null
          page_message?: string | null
          page_title?: string | null
          redirect_delay?: number | null
          redirect_url?: string | null
          slug: string
          updated_at?: string
          value?: number | null
          whatsapp_message?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          delivery_webhook_url?: string | null
          id?: string
          is_active?: boolean | null
          member_cover_image?: string | null
          member_description?: string | null
          name?: string
          page_logo?: string | null
          page_message?: string | null
          page_title?: string | null
          redirect_delay?: number | null
          redirect_url?: string | null
          slug?: string
          updated_at?: string
          value?: number | null
          whatsapp_message?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      delivery_settings: {
        Row: {
          created_at: string
          custom_domain: string | null
          global_redirect_url: string | null
          id: string
          link_message_template: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          global_redirect_url?: string | null
          id?: string
          link_message_template?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          global_redirect_url?: string | null
          id?: string
          link_message_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      evolution_api_settings: {
        Row: {
          abandoned_recovery_enabled: boolean
          api_key: string
          boleto_recovery_enabled: boolean
          created_at: string
          cron_enabled: boolean
          cron_interval_minutes: number
          daily_limit: number
          delay_between_messages: number
          id: string
          instance_name: string
          is_active: boolean
          pix_card_recovery_enabled: boolean
          server_url: string
          updated_at: string
          working_hours_enabled: boolean
          working_hours_end: number
          working_hours_start: number
        }
        Insert: {
          abandoned_recovery_enabled?: boolean
          api_key?: string
          boleto_recovery_enabled?: boolean
          created_at?: string
          cron_enabled?: boolean
          cron_interval_minutes?: number
          daily_limit?: number
          delay_between_messages?: number
          id?: string
          instance_name?: string
          is_active?: boolean
          pix_card_recovery_enabled?: boolean
          server_url?: string
          updated_at?: string
          working_hours_enabled?: boolean
          working_hours_end?: number
          working_hours_start?: number
        }
        Update: {
          abandoned_recovery_enabled?: boolean
          api_key?: string
          boleto_recovery_enabled?: boolean
          created_at?: string
          cron_enabled?: boolean
          cron_interval_minutes?: number
          daily_limit?: number
          delay_between_messages?: number
          id?: string
          instance_name?: string
          is_active?: boolean
          pix_card_recovery_enabled?: boolean
          server_url?: string
          updated_at?: string
          working_hours_enabled?: boolean
          working_hours_end?: number
          working_hours_start?: number
        }
        Relationships: []
      }
      evolution_message_log: {
        Row: {
          abandoned_event_id: string | null
          created_at: string
          error_message: string | null
          evolution_response: Json | null
          id: string
          message: string
          message_type: string
          phone: string
          sent_at: string | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          abandoned_event_id?: string | null
          created_at?: string
          error_message?: string | null
          evolution_response?: Json | null
          id?: string
          message: string
          message_type: string
          phone: string
          sent_at?: string | null
          status?: string
          transaction_id?: string | null
        }
        Update: {
          abandoned_event_id?: string | null
          created_at?: string
          error_message?: string | null
          evolution_response?: Json | null
          id?: string
          message?: string
          message_type?: string
          phone?: string
          sent_at?: string | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evolution_message_log_abandoned_event_id_fkey"
            columns: ["abandoned_event_id"]
            isOneToOne: false
            referencedRelation: "abandoned_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolution_message_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_settings: {
        Row: {
          created_at: string
          id: string
          tax_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      global_delivery_pixels: {
        Row: {
          access_token: string | null
          created_at: string
          event_name: string | null
          id: string
          is_active: boolean | null
          pixel_id: string
          platform: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          event_name?: string | null
          id?: string
          is_active?: boolean | null
          pixel_id: string
          platform: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          event_name?: string | null
          id?: string
          is_active?: boolean | null
          pixel_id?: string
          platform?: string
        }
        Relationships: []
      }
      group_statistics_history: {
        Row: {
          created_at: string
          current_members: number
          date: string
          entries: number
          exits: number
          group_id: string
          id: string
        }
        Insert: {
          created_at?: string
          current_members?: number
          date?: string
          entries?: number
          exits?: number
          group_id: string
          id?: string
        }
        Update: {
          created_at?: string
          current_members?: number
          date?: string
          entries?: number
          exits?: number
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_statistics_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          active_link: string | null
          batch_number: number | null
          created_at: string
          current_members: number
          id: string
          last_day_total_entries: number | null
          last_day_total_exits: number | null
          last_reset_date: string | null
          name: string
          total_entries: number
          total_exits: number
          updated_at: string
          whatsapp_id: string | null
          whatsapp_url: string | null
        }
        Insert: {
          active_link?: string | null
          batch_number?: number | null
          created_at?: string
          current_members?: number
          id?: string
          last_day_total_entries?: number | null
          last_day_total_exits?: number | null
          last_reset_date?: string | null
          name: string
          total_entries?: number
          total_exits?: number
          updated_at?: string
          whatsapp_id?: string | null
          whatsapp_url?: string | null
        }
        Update: {
          active_link?: string | null
          batch_number?: number | null
          created_at?: string
          current_members?: number
          id?: string
          last_day_total_entries?: number | null
          last_day_total_exits?: number | null
          last_reset_date?: string | null
          name?: string
          total_entries?: number
          total_exits?: number
          updated_at?: string
          whatsapp_id?: string | null
          whatsapp_url?: string | null
        }
        Relationships: []
      }
      manual_boleto_settings: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          webhook_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          webhook_url?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          webhook_url?: string
        }
        Relationships: []
      }
      manual_revenues: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          received_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          received_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          received_at?: string
        }
        Relationships: []
      }
      member_area_offers: {
        Row: {
          card_payment_url: string | null
          category_tag: string | null
          created_at: string
          description: string | null
          display_type: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          pix_key: string | null
          pix_key_type: string | null
          price: number | null
          product_id: string | null
          purchase_url: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          card_payment_url?: string | null
          category_tag?: string | null
          created_at?: string
          description?: string | null
          display_type?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          pix_key?: string | null
          pix_key_type?: string | null
          price?: number | null
          product_id?: string | null
          purchase_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          card_payment_url?: string | null
          category_tag?: string | null
          created_at?: string
          description?: string | null
          display_type?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          pix_key?: string | null
          pix_key_type?: string | null
          price?: number | null
          product_id?: string | null
          purchase_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_area_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
        ]
      }
      member_area_settings: {
        Row: {
          ai_persona_prompt: string | null
          created_at: string
          id: string
          layout_order: Json | null
          logo_url: string | null
          theme_color: string | null
          title: string
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          ai_persona_prompt?: string | null
          created_at?: string
          id?: string
          layout_order?: Json | null
          logo_url?: string | null
          theme_color?: string | null
          title?: string
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          ai_persona_prompt?: string | null
          created_at?: string
          id?: string
          layout_order?: Json | null
          logo_url?: string | null
          theme_color?: string | null
          title?: string
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      member_content_progress: {
        Row: {
          created_at: string | null
          current_page: number | null
          id: string
          last_accessed_at: string | null
          material_id: string
          normalized_phone: string
          progress_type: string
          total_pages: number | null
          video_duration: number | null
          video_seconds: number | null
        }
        Insert: {
          created_at?: string | null
          current_page?: number | null
          id?: string
          last_accessed_at?: string | null
          material_id: string
          normalized_phone: string
          progress_type?: string
          total_pages?: number | null
          video_duration?: number | null
          video_seconds?: number | null
        }
        Update: {
          created_at?: string | null
          current_page?: number | null
          id?: string
          last_accessed_at?: string | null
          material_id?: string
          normalized_phone?: string
          progress_type?: string
          total_pages?: number | null
          video_duration?: number | null
          video_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_content_progress_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "member_product_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      member_offer_impressions: {
        Row: {
          clicked: boolean
          created_at: string
          id: string
          impression_count: number
          last_shown_at: string | null
          normalized_phone: string
          offer_id: string
        }
        Insert: {
          clicked?: boolean
          created_at?: string
          id?: string
          impression_count?: number
          last_shown_at?: string | null
          normalized_phone: string
          offer_id: string
        }
        Update: {
          clicked?: boolean
          created_at?: string
          id?: string
          impression_count?: number
          last_shown_at?: string | null
          normalized_phone?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_offer_impressions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "member_area_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      member_pixel_frames: {
        Row: {
          created_at: string
          fired: boolean
          fired_at: string | null
          id: string
          normalized_phone: string
          product_id: string | null
          product_name: string
          product_value: number
        }
        Insert: {
          created_at?: string
          fired?: boolean
          fired_at?: string | null
          id?: string
          normalized_phone: string
          product_id?: string | null
          product_name: string
          product_value?: number
        }
        Update: {
          created_at?: string
          fired?: boolean
          fired_at?: string | null
          id?: string
          normalized_phone?: string
          product_id?: string | null
          product_name?: string
          product_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_pixel_frames_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
        ]
      }
      member_product_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
        ]
      }
      member_product_materials: {
        Row: {
          button_label: string | null
          category_id: string | null
          content_text: string | null
          content_type: string
          content_url: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_preview: boolean
          product_id: string
          sort_order: number
          title: string
        }
        Insert: {
          button_label?: string | null
          category_id?: string | null
          content_text?: string | null
          content_type?: string
          content_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_preview?: boolean
          product_id: string
          sort_order?: number
          title: string
        }
        Update: {
          button_label?: string | null
          category_id?: string | null
          content_text?: string | null
          content_type?: string
          content_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_preview?: boolean
          product_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_product_materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "member_product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_product_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
        ]
      }
      member_products: {
        Row: {
          created_at: string
          granted_at: string
          id: string
          is_active: boolean
          normalized_phone: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          id?: string
          is_active?: boolean
          normalized_phone: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          id?: string
          is_active?: boolean
          normalized_phone?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads_settings: {
        Row: {
          access_token: string
          ad_account_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          ad_account_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          ad_account_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mind_map_connections: {
        Row: {
          color: string | null
          created_at: string
          id: string
          project_id: string
          source_node_id: string
          style: string | null
          target_node_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          project_id: string
          source_node_id: string
          style?: string | null
          target_node_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          project_id?: string
          source_node_id?: string
          style?: string | null
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mind_map_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mind_map_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mind_map_connections_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "mind_map_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mind_map_connections_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "mind_map_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      mind_map_nodes: {
        Row: {
          bg_color: string | null
          color: string | null
          created_at: string
          font_size: number | null
          id: string
          label: string
          parent_id: string | null
          position_x: number
          position_y: number
          project_id: string
          shape: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          bg_color?: string | null
          color?: string | null
          created_at?: string
          font_size?: number | null
          id?: string
          label: string
          parent_id?: string | null
          position_x?: number
          position_y?: number
          project_id: string
          shape?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          bg_color?: string | null
          color?: string | null
          created_at?: string
          font_size?: number | null
          id?: string
          label?: string
          parent_id?: string | null
          position_x?: number
          position_y?: number
          project_id?: string
          shape?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mind_map_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "mind_map_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mind_map_nodes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mind_map_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mind_map_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          section: string | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          section?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          section?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      openai_settings: {
        Row: {
          api_key: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      phone_validations: {
        Row: {
          created_at: string
          exists_on_whatsapp: boolean
          id: string
          is_mobile: boolean | null
          jid: string | null
          normalized_phone: string
          validated_at: string
        }
        Insert: {
          created_at?: string
          exists_on_whatsapp?: boolean
          id?: string
          is_mobile?: boolean | null
          jid?: string | null
          normalized_phone: string
          validated_at?: string
        }
        Update: {
          created_at?: string
          exists_on_whatsapp?: boolean
          id?: string
          is_mobile?: boolean | null
          jid?: string | null
          normalized_phone?: string
          validated_at?: string
        }
        Relationships: []
      }
      pix_card_recovery_clicks: {
        Row: {
          clicked_at: string
          created_at: string
          id: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          clicked_at?: string
          created_at?: string
          id?: string
          transaction_id: string
          user_id: string
        }
        Update: {
          clicked_at?: string
          created_at?: string
          id?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_card_recovery_clicks_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_card_recovery_settings: {
        Row: {
          created_at: string
          id: string
          message: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          updated_at?: string
        }
        Relationships: []
      }
      pixel_fire_logs: {
        Row: {
          created_at: string | null
          id: string
          phone: string
          pixels_fired: Json
          product_id: string | null
          product_name: string
          product_value: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          phone: string
          pixels_fired?: Json
          product_id?: string | null
          product_name: string
          product_value?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          phone?: string
          pixels_fired?: Json
          product_id?: string | null
          product_name?: string
          product_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pixel_fire_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_knowledge_summaries: {
        Row: {
          created_at: string
          id: string
          key_topics: string[]
          product_id: string
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_topics?: string[]
          product_id: string
          summary?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          key_topics?: string[]
          product_id?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_knowledge_summaries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "delivery_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      psalms: {
        Row: {
          created_at: string
          id: string
          psalm_number: number
          reference: string
          text: string
          verse_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          psalm_number: number
          reference: string
          text: string
          verse_number: string
        }
        Update: {
          created_at?: string
          id?: string
          psalm_number?: number
          reference?: string
          text?: string
          verse_number?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_responses: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          sort_order: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          message: string
          sort_order?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          sort_order?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          normalized_phone: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          webhook_source: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          normalized_phone?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          webhook_source?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          normalized_phone?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          webhook_source?: string | null
        }
        Relationships: []
      }
      typebot_daily_stats: {
        Row: {
          completed_leads: number
          created_at: string
          date: string
          id: string
          total_leads: number
          typebot_id: string
          typebot_name: string
          updated_at: string
        }
        Insert: {
          completed_leads?: number
          created_at?: string
          date?: string
          id?: string
          total_leads?: number
          typebot_id: string
          typebot_name: string
          updated_at?: string
        }
        Update: {
          completed_leads?: number
          created_at?: string
          date?: string
          id?: string
          total_leads?: number
          typebot_id?: string
          typebot_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      useful_links: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          is_allowed: boolean
          permission_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          permission_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          permission_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_totp_secrets: {
        Row: {
          created_at: string
          id: string
          secret: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          secret: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          secret?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      wirepusher_notification_templates: {
        Row: {
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          message: string
          notification_type: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          is_active?: boolean
          message: string
          notification_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          message?: string
          notification_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      wirepusher_settings: {
        Row: {
          created_at: string
          device_id: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_phone_variations: { Args: { phone: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_phone: { Args: { phone: string }; Returns: string }
      refresh_customer_stats: {
        Args: { customer_normalized_phone?: string }
        Returns: undefined
      }
      sync_delivery_leads_to_customers: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
      transaction_status:
        | "gerado"
        | "pago"
        | "pendente"
        | "cancelado"
        | "expirado"
      transaction_type: "boleto" | "pix" | "cartao"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
      transaction_status: [
        "gerado",
        "pago",
        "pendente",
        "cancelado",
        "expirado",
      ],
      transaction_type: ["boleto", "pix", "cartao"],
    },
  },
} as const
