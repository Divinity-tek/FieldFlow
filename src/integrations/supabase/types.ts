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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_secrets: {
        Row: {
          api_key: string | null
          id: boolean
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          id?: boolean
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          base_url: string | null
          id: boolean
          model: string | null
          provider: string
          updated_at: string
          updated_by: string | null
          vision_model: string | null
        }
        Insert: {
          base_url?: string | null
          id?: boolean
          model?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
          vision_model?: string | null
        }
        Update: {
          base_url?: string | null
          id?: boolean
          model?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
          vision_model?: string | null
        }
        Relationships: []
      }
      ai_tool_presets: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string
          prompt: string
          sort_order: number
          structured: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          label: string
          prompt: string
          sort_order?: number
          structured?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          prompt?: string
          sort_order?: number
          structured?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_service_history: {
        Row: {
          asset_id: string
          created_at: string
          description: string | null
          engineer_id: string | null
          id: string
          job_id: string | null
          next_service_due: string | null
          service_type: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          description?: string | null
          engineer_id?: string | null
          id?: string
          job_id?: string | null
          next_service_due?: string | null
          service_type?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          description?: string | null
          engineer_id?: string | null
          id?: string
          job_id?: string | null
          next_service_due?: string | null
          service_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_service_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "client_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_service_history_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_service_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_service_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      candidate_nominations: {
        Row: {
          candidate_email: string | null
          candidate_name: string
          candidate_phone: string | null
          created_at: string | null
          id: string
          job_id: string
          notes: string | null
          recruiter_id: string
          resume_url: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["nomination_status"]
        }
        Insert: {
          candidate_email?: string | null
          candidate_name: string
          candidate_phone?: string | null
          created_at?: string | null
          id?: string
          job_id: string
          notes?: string | null
          recruiter_id: string
          resume_url?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["nomination_status"]
        }
        Update: {
          candidate_email?: string | null
          candidate_name?: string
          candidate_phone?: string | null
          created_at?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          recruiter_id?: string
          resume_url?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["nomination_status"]
        }
        Relationships: [
          {
            foreignKeyName: "candidate_nominations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_nominations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_nominations_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_nominations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_types: {
        Row: {
          category: string
          code: string
          created_at: string
          default_validity_months: number | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          issuer: string | null
          name: string
          requires_expiry: boolean
          updated_at: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          default_validity_months?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          issuer?: string | null
          name: string
          requires_expiry?: boolean
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          default_validity_months?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          issuer?: string | null
          name?: string
          requires_expiry?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          share_token: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          share_token?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          share_token?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_members: {
        Row: {
          id: string
          joined_at: string
          last_read_at: string | null
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_messages: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_deleted: boolean
          is_pinned: boolean
          message_type: string
          metadata: Json | null
          pinned_at: string | null
          pinned_by: string | null
          reply_to_id: string | null
          room_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          message_type?: string
          metadata?: Json | null
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          room_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          message_type?: string
          metadata?: Json | null
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_room_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          created_by: string
          id: string
          job_id: string | null
          name: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          job_id?: string | null
          name: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          job_id?: string | null
          name?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sync_failures: {
        Row: {
          attempts: number
          created_at: string
          error: string
          id: string
          last_attempt_at: string
          message_id: string | null
          op: string
          resolved_at: string | null
          resolved_by: string | null
          room_id: string | null
          status: string
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error: string
          id?: string
          last_attempt_at?: string
          message_id?: string | null
          op: string
          resolved_at?: string | null
          resolved_by?: string | null
          room_id?: string | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string
          id?: string
          last_attempt_at?: string
          message_id?: string | null
          op?: string
          resolved_at?: string | null
          resolved_by?: string | null
          room_id?: string | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_addresses: {
        Row: {
          address_line: string
          city: string | null
          client_id: string
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string
          notes: string | null
          postal_code: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          address_line: string
          city?: string | null
          client_id: string
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          notes?: string | null
          postal_code?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string
          city?: string | null
          client_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          notes?: string | null
          postal_code?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assets: {
        Row: {
          asset_type: string
          client_id: string
          created_at: string
          id: string
          install_date: string | null
          location: string | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          serial_number: string | null
          status: string
          updated_at: string
          warranty_expiry: string | null
        }
        Insert: {
          asset_type?: string
          client_id: string
          created_at?: string
          id?: string
          install_date?: string | null
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          warranty_expiry?: string | null
        }
        Update: {
          asset_type?: string
          client_id?: string
          created_at?: string
          id?: string
          install_date?: string | null
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          client_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip: string | null
          metadata: Json
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          client_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          client_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_audit_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_communications: {
        Row: {
          client_id: string
          content: string | null
          created_at: string
          id: string
          subject: string
          type: string
          user_id: string
        }
        Insert: {
          client_id: string
          content?: string | null
          created_at?: string
          id?: string
          subject: string
          type?: string
          user_id: string
        }
        Update: {
          client_id?: string
          content?: string | null
          created_at?: string
          id?: string
          subject?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_estimate_decisions: {
        Row: {
          client_id: string
          comment: string | null
          decided_at: string
          decided_by: string | null
          decision: string
          estimate_id: string
          id: string
          ip: string | null
          signature_data: string | null
          user_agent: string | null
        }
        Insert: {
          client_id: string
          comment?: string | null
          decided_at?: string
          decided_by?: string | null
          decision: string
          estimate_id: string
          id?: string
          ip?: string | null
          signature_data?: string | null
          user_agent?: string | null
        }
        Update: {
          client_id?: string
          comment?: string | null
          decided_at?: string
          decided_by?: string | null
          decision?: string
          estimate_id?: string
          id?: string
          ip?: string | null
          signature_data?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_estimate_decisions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_estimate_decisions_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invoice_payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          external_ref: string | null
          id: string
          invoice_id: string | null
          linked_at: string | null
          paid_at: string
          payment_method_id: string | null
          receipt_id: string | null
          receipt_url: string | null
          status: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          external_ref?: string | null
          id?: string
          invoice_id?: string | null
          linked_at?: string | null
          paid_at?: string
          payment_method_id?: string | null
          receipt_id?: string | null
          receipt_url?: string | null
          status?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          external_ref?: string | null
          id?: string
          invoice_id?: string | null
          linked_at?: string | null
          paid_at?: string
          payment_method_id?: string | null
          receipt_id?: string | null
          receipt_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invoice_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invoice_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "client_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invoice_payments_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_job_messages: {
        Row: {
          attachments: Json
          body: string
          client_id: string
          created_at: string
          id: string
          job_id: string
          read_at: string | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          attachments?: Json
          body: string
          client_id: string
          created_at?: string
          id?: string
          job_id: string
          read_at?: string | null
          sender_id: string
          sender_type?: string
        }
        Update: {
          attachments?: Json
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          job_id?: string
          read_at?: string | null
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_job_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_job_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_job_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notification_prefs: {
        Row: {
          client_id: string
          created_at: string
          email_enabled: boolean
          event_key: string
          id: string
          sms_enabled: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email_enabled?: boolean
          event_key: string
          id?: string
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email_enabled?: boolean
          event_key?: string
          id?: string
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_notification_prefs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payment_methods: {
        Row: {
          brand: string | null
          client_id: string
          created_at: string
          exp_month: number | null
          exp_year: number | null
          external_ref: string | null
          holder_name: string | null
          id: string
          is_autopay: boolean
          is_default: boolean
          last4: string | null
          type: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          client_id: string
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          external_ref?: string | null
          holder_name?: string | null
          id?: string
          is_autopay?: boolean
          is_default?: boolean
          last4?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          client_id?: string
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          external_ref?: string | null
          holder_name?: string | null
          id?: string
          is_autopay?: boolean
          is_default?: boolean
          last4?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payment_methods_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_branding: {
        Row: {
          accent_color: string | null
          client_id: string
          created_at: string
          id: string
          logo_url: string | null
          primary_color: string | null
          subdomain: string | null
          support_email: string | null
          support_phone: string | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          accent_color?: string | null
          client_id: string
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          subdomain?: string | null
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          accent_color?: string | null
          client_id?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          subdomain?: string | null
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_branding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_service_requests: {
        Row: {
          address_id: string | null
          attachments: Json
          cancellation_policy_hours: number
          cancelled_at: string | null
          cancelled_reason: string | null
          client_id: string
          converted_job_id: string | null
          created_at: string
          description: string | null
          desired_date: string | null
          id: string
          is_recurring: boolean
          priority: string
          recurrence_ends_on: string | null
          recurrence_rrule: string | null
          rescheduled_at: string | null
          service_type: string | null
          status: string
          submitted_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          attachments?: Json
          cancellation_policy_hours?: number
          cancelled_at?: string | null
          cancelled_reason?: string | null
          client_id: string
          converted_job_id?: string | null
          created_at?: string
          description?: string | null
          desired_date?: string | null
          id?: string
          is_recurring?: boolean
          priority?: string
          recurrence_ends_on?: string | null
          recurrence_rrule?: string | null
          rescheduled_at?: string | null
          service_type?: string | null
          status?: string
          submitted_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          attachments?: Json
          cancellation_policy_hours?: number
          cancelled_at?: string | null
          cancelled_reason?: string | null
          client_id?: string
          converted_job_id?: string | null
          created_at?: string
          description?: string | null
          desired_date?: string | null
          id?: string
          is_recurring?: boolean
          priority?: string
          recurrence_ends_on?: string | null
          recurrence_rrule?: string | null
          rescheduled_at?: string | null
          service_type?: string | null
          status?: string
          submitted_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_service_requests_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "client_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_service_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_site_assets: {
        Row: {
          address_id: string | null
          category: string | null
          client_id: string
          created_at: string
          documents: Json
          id: string
          install_date: string | null
          name: string
          next_pm_at: string | null
          notes: string | null
          serial_number: string | null
          updated_at: string
          warranty_until: string | null
        }
        Insert: {
          address_id?: string | null
          category?: string | null
          client_id: string
          created_at?: string
          documents?: Json
          id?: string
          install_date?: string | null
          name: string
          next_pm_at?: string | null
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
          warranty_until?: string | null
        }
        Update: {
          address_id?: string | null
          category?: string | null
          client_id?: string
          created_at?: string
          documents?: Json
          id?: string
          install_date?: string | null
          name?: string
          next_pm_at?: string | null
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_site_assets_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "client_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_site_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          client_id: string
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          role: Database["public"]["Enums"]["client_portal_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: Database["public"]["Enums"]["client_portal_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: Database["public"]["Enums"]["client_portal_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          address_line1: string | null
          billing_contact_email: string | null
          billing_contact_name: string | null
          billing_contact_phone: string | null
          city: string | null
          company_name: string
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          country: string | null
          created_at: string
          email: string
          entity_name: string | null
          id: string
          links: Json
          logo_url: string | null
          notes: string | null
          partner_id: string | null
          phone: string | null
          postcode: string | null
          region: string | null
          status: string
          tax_country: string | null
          tax_id: string | null
          tax_notes: string | null
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          address_line1?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          city?: string | null
          company_name: string
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          email: string
          entity_name?: string | null
          id?: string
          links?: Json
          logo_url?: string | null
          notes?: string | null
          partner_id?: string | null
          phone?: string | null
          postcode?: string | null
          region?: string | null
          status?: string
          tax_country?: string | null
          tax_id?: string | null
          tax_notes?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          address_line1?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          city?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          email?: string
          entity_name?: string | null
          id?: string
          links?: Json
          logo_url?: string | null
          notes?: string | null
          partner_id?: string | null
          phone?: string | null
          postcode?: string | null
          region?: string | null
          status?: string
          tax_country?: string | null
          tax_id?: string | null
          tax_notes?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_clients_partner"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string
          order_id: string | null
          paid_at: string | null
          status: string
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          order_id?: string | null
          paid_at?: string | null
          status?: string
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          order_id?: string | null
          paid_at?: string | null
          status?: string
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_orders: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          fulfilled_at: string | null
          id: string
          order_number: string
          ordered_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          fulfilled_at?: string | null
          id?: string
          order_number?: string
          ordered_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          fulfilled_at?: string | null
          id?: string
          order_number?: string
          ordered_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_circuits: {
        Row: {
          bandwidth_mbps: number | null
          circuit_id: string
          circuit_type: string
          client_id: string
          contract_end_date: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          install_date: string | null
          ip_block: string | null
          monthly_cost: number
          notes: string | null
          project_id: string | null
          provider: string
          site_name: string
          status: string
          updated_at: string
        }
        Insert: {
          bandwidth_mbps?: number | null
          circuit_id: string
          circuit_type?: string
          client_id: string
          contract_end_date?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          install_date?: string | null
          ip_block?: string | null
          monthly_cost?: number
          notes?: string | null
          project_id?: string | null
          provider: string
          site_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          bandwidth_mbps?: number | null
          circuit_id?: string
          circuit_type?: string
          client_id?: string
          contract_end_date?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          install_date?: string | null
          ip_block?: string | null
          monthly_cost?: number
          notes?: string | null
          project_id?: string | null
          provider?: string
          site_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      dispatch_agent_actions: {
        Row: {
          action_type: string
          autonomy: string | null
          created_at: string
          engineer_id: string | null
          id: string
          idempotency_key: string | null
          job_id: string | null
          payload: Json
          reasoning: string | null
          score: number | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          action_type: string
          autonomy?: string | null
          created_at?: string
          engineer_id?: string | null
          id?: string
          idempotency_key?: string | null
          job_id?: string | null
          payload?: Json
          reasoning?: string | null
          score?: number | null
          status?: string
          triggered_by?: string | null
        }
        Update: {
          action_type?: string
          autonomy?: string | null
          created_at?: string
          engineer_id?: string | null
          id?: string
          idempotency_key?: string | null
          job_id?: string | null
          payload?: Json
          reasoning?: string | null
          score?: number | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      dispatch_agent_approvals: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string | null
          job_id: string
          payload: Json
          reason: string | null
          recommended_engineer_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          score: number | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          job_id: string
          payload?: Json
          reason?: string | null
          recommended_engineer_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          score?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          job_id?: string
          payload?: Json
          reason?: string | null
          recommended_engineer_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          score?: number | null
          status?: string
        }
        Relationships: []
      }
      dispatch_agent_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      dispatch_agent_settings: {
        Row: {
          approval_required_service_types: string[]
          approval_required_statuses: string[]
          autonomy: string
          created_at: string
          enabled: boolean
          escalation_levels: Json
          id: string
          lifecycle_secret: string | null
          max_auto_assign_radius_km: number
          notify_on_sla_warning: boolean
          reassign_on_sla_breach: boolean
          reassign_scan_enabled: boolean
          require_approval_priorities: string[]
          scheduling_enabled: boolean
          sla_breach_threshold_minutes: number
          sla_risk_threshold_minutes: number
          sla_warning_threshold_minutes: number
          updated_at: string
          updated_by: string | null
          weight_distance: number
          weight_experience: number
          weight_rating: number
          weight_skill: number
          working_hours_end: string
          working_hours_only: boolean
          working_hours_start: string
        }
        Insert: {
          approval_required_service_types?: string[]
          approval_required_statuses?: string[]
          autonomy?: string
          created_at?: string
          enabled?: boolean
          escalation_levels?: Json
          id?: string
          lifecycle_secret?: string | null
          max_auto_assign_radius_km?: number
          notify_on_sla_warning?: boolean
          reassign_on_sla_breach?: boolean
          reassign_scan_enabled?: boolean
          require_approval_priorities?: string[]
          scheduling_enabled?: boolean
          sla_breach_threshold_minutes?: number
          sla_risk_threshold_minutes?: number
          sla_warning_threshold_minutes?: number
          updated_at?: string
          updated_by?: string | null
          weight_distance?: number
          weight_experience?: number
          weight_rating?: number
          weight_skill?: number
          working_hours_end?: string
          working_hours_only?: boolean
          working_hours_start?: string
        }
        Update: {
          approval_required_service_types?: string[]
          approval_required_statuses?: string[]
          autonomy?: string
          created_at?: string
          enabled?: boolean
          escalation_levels?: Json
          id?: string
          lifecycle_secret?: string | null
          max_auto_assign_radius_km?: number
          notify_on_sla_warning?: boolean
          reassign_on_sla_breach?: boolean
          reassign_scan_enabled?: boolean
          require_approval_priorities?: string[]
          scheduling_enabled?: boolean
          sla_breach_threshold_minutes?: number
          sla_risk_threshold_minutes?: number
          sla_warning_threshold_minutes?: number
          updated_at?: string
          updated_by?: string | null
          weight_distance?: number
          weight_experience?: number
          weight_rating?: number
          weight_skill?: number
          working_hours_end?: string
          working_hours_only?: boolean
          working_hours_start?: string
        }
        Relationships: []
      }
      dispatch_leads: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          company: string
          created_at: string
          duration_estimate: string | null
          email: string
          estimated_turnaround_minutes: number | null
          full_name: string
          id: string
          internal_notes: string | null
          ip_address: string | null
          lost_at: string | null
          lost_reason: string | null
          phone: string | null
          preferred_date: string
          preferred_window: string
          quoted_amount: number | null
          quoted_at: string | null
          quoted_currency: string
          scope: string
          service_level: string
          site_access_notes: string | null
          site_address: string
          site_city: string
          site_contact: string | null
          site_country: string
          site_postal_code: string
          sla: string
          source_url: string | null
          status: string
          updated_at: string
          user_agent: string | null
          won_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          company: string
          created_at?: string
          duration_estimate?: string | null
          email: string
          estimated_turnaround_minutes?: number | null
          full_name: string
          id?: string
          internal_notes?: string | null
          ip_address?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          phone?: string | null
          preferred_date: string
          preferred_window: string
          quoted_amount?: number | null
          quoted_at?: string | null
          quoted_currency?: string
          scope: string
          service_level: string
          site_access_notes?: string | null
          site_address: string
          site_city: string
          site_contact?: string | null
          site_country: string
          site_postal_code: string
          sla: string
          source_url?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          won_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          company?: string
          created_at?: string
          duration_estimate?: string | null
          email?: string
          estimated_turnaround_minutes?: number | null
          full_name?: string
          id?: string
          internal_notes?: string | null
          ip_address?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          phone?: string | null
          preferred_date?: string
          preferred_window?: string
          quoted_amount?: number | null
          quoted_at?: string | null
          quoted_currency?: string
          scope?: string
          service_level?: string
          site_access_notes?: string | null
          site_address?: string
          site_city?: string
          site_contact?: string | null
          site_country?: string
          site_postal_code?: string
          sla?: string
          source_url?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          won_at?: string | null
        }
        Relationships: []
      }
      dispatch_notification_recipients: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dispatch_ticket_history: {
        Row: {
          changed_by: string | null
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          ticket_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_ticket_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "dispatch_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_tickets: {
        Row: {
          actual_charges: number | null
          actual_hours: number | null
          approved_at: string | null
          approved_by: string | null
          client_approval_status: string
          client_id: string
          completed_date: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          dispatch_type: string
          engineer_id: string | null
          engineer_notes: string | null
          estimated_charges: number | null
          estimated_hours: number
          hourly_rate: number
          id: string
          job_id: string | null
          materials_cost: number | null
          priority: string
          scheduled_date: string | null
          scope_of_work_items: Json | null
          site_address: string
          sow_description: string
          status: string
          ticket_number: string
          title: string
          travel_rate: number | null
          travel_time: number | null
          updated_at: string
        }
        Insert: {
          actual_charges?: number | null
          actual_hours?: number | null
          approved_at?: string | null
          approved_by?: string | null
          client_approval_status?: string
          client_id: string
          completed_date?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          dispatch_type?: string
          engineer_id?: string | null
          engineer_notes?: string | null
          estimated_charges?: number | null
          estimated_hours?: number
          hourly_rate?: number
          id?: string
          job_id?: string | null
          materials_cost?: number | null
          priority?: string
          scheduled_date?: string | null
          scope_of_work_items?: Json | null
          site_address?: string
          sow_description?: string
          status?: string
          ticket_number?: string
          title: string
          travel_rate?: number | null
          travel_time?: number | null
          updated_at?: string
        }
        Update: {
          actual_charges?: number | null
          actual_hours?: number | null
          approved_at?: string | null
          approved_by?: string | null
          client_approval_status?: string
          client_id?: string
          completed_date?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          dispatch_type?: string
          engineer_id?: string | null
          engineer_notes?: string | null
          estimated_charges?: number | null
          estimated_hours?: number
          hourly_rate?: number
          id?: string
          job_id?: string | null
          materials_cost?: number | null
          priority?: string
          scheduled_date?: string | null
          scope_of_work_items?: Json | null
          site_address?: string
          sow_description?: string
          status?: string
          ticket_number?: string
          title?: string
          travel_rate?: number | null
          travel_time?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_tickets_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_tickets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_tickets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_availability: {
        Row: {
          created_at: string
          date: string
          end_time: string
          engineer_id: string
          id: string
          is_available: boolean
          notes: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string
          engineer_id: string
          id?: string
          is_available?: boolean
          notes?: string | null
          start_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          engineer_id?: string
          id?: string
          is_available?: boolean
          notes?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_availability_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_availability_preferences: {
        Row: {
          after_hours: boolean
          business_days: number[]
          business_end: string
          business_hours: boolean
          business_start: string
          created_at: string
          engineer_id: string
          holidays: boolean
          id: string
          nights: boolean
          notes: string | null
          timezone: string | null
          updated_at: string
          weekends: boolean
        }
        Insert: {
          after_hours?: boolean
          business_days?: number[]
          business_end?: string
          business_hours?: boolean
          business_start?: string
          created_at?: string
          engineer_id: string
          holidays?: boolean
          id?: string
          nights?: boolean
          notes?: string | null
          timezone?: string | null
          updated_at?: string
          weekends?: boolean
        }
        Update: {
          after_hours?: boolean
          business_days?: number[]
          business_end?: string
          business_hours?: boolean
          business_start?: string
          created_at?: string
          engineer_id?: string
          holidays?: boolean
          id?: string
          nights?: boolean
          notes?: string | null
          timezone?: string | null
          updated_at?: string
          weekends?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "engineer_availability_preferences_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: true
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_backouts: {
        Row: {
          backout_type: string
          created_at: string
          engineer_id: string
          hours_before_scheduled: number | null
          id: string
          job_id: string | null
          reason: string | null
          recorded_by: string | null
        }
        Insert: {
          backout_type?: string
          created_at?: string
          engineer_id: string
          hours_before_scheduled?: number | null
          id?: string
          job_id?: string | null
          reason?: string | null
          recorded_by?: string | null
        }
        Update: {
          backout_type?: string
          created_at?: string
          engineer_id?: string
          hours_before_scheduled?: number | null
          id?: string
          job_id?: string | null
          reason?: string | null
          recorded_by?: string | null
        }
        Relationships: []
      }
      engineer_bank_details: {
        Row: {
          account_holder_name: string
          account_number: string | null
          additional_notes: string | null
          bank_name: string
          country_code: string
          created_at: string | null
          currency: string
          engineer_id: string
          iban: string | null
          id: string
          local_bank_code: string | null
          local_bank_code_type: string | null
          swift_bic: string | null
          updated_at: string | null
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_holder_name: string
          account_number?: string | null
          additional_notes?: string | null
          bank_name: string
          country_code: string
          created_at?: string | null
          currency: string
          engineer_id: string
          iban?: string | null
          id?: string
          local_bank_code?: string | null
          local_bank_code_type?: string | null
          swift_bic?: string | null
          updated_at?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_holder_name?: string
          account_number?: string | null
          additional_notes?: string | null
          bank_name?: string
          country_code?: string
          created_at?: string | null
          currency?: string
          engineer_id?: string
          iban?: string | null
          id?: string
          local_bank_code?: string | null
          local_bank_code_type?: string | null
          swift_bic?: string | null
          updated_at?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engineer_bank_details_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: true
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_bank_details_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      engineer_certifications: {
        Row: {
          certificate_number: string | null
          certification_type_id: string
          created_at: string
          document_url: string | null
          engineer_id: string
          expiry_date: string | null
          id: string
          issued_date: string | null
          notes: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          certificate_number?: string | null
          certification_type_id: string
          created_at?: string
          document_url?: string | null
          engineer_id: string
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          certificate_number?: string | null
          certification_type_id?: string
          created_at?: string
          document_url?: string | null
          engineer_id?: string
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      engineer_checkins: {
        Row: {
          checked_in_at: string
          created_at: string
          delta_minutes: number
          engineer_id: string
          id: string
          job_id: string
          scheduled_at: string
          timeliness_category: string
        }
        Insert: {
          checked_in_at: string
          created_at?: string
          delta_minutes: number
          engineer_id: string
          id?: string
          job_id: string
          scheduled_at: string
          timeliness_category?: string
        }
        Update: {
          checked_in_at?: string
          created_at?: string
          delta_minutes?: number
          engineer_id?: string
          id?: string
          job_id?: string
          scheduled_at?: string
          timeliness_category?: string
        }
        Relationships: []
      }
      engineer_expenses: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string
          currency: string | null
          engineer_id: string
          id: string
          job_id: string | null
          notes: string | null
          occurred_on: string | null
          ocr_raw: Json | null
          receipt_path: string | null
          status: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          created_at?: string
          currency?: string | null
          engineer_id: string
          id?: string
          job_id?: string | null
          notes?: string | null
          occurred_on?: string | null
          ocr_raw?: Json | null
          receipt_path?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          created_at?: string
          currency?: string | null
          engineer_id?: string
          id?: string
          job_id?: string | null
          notes?: string | null
          occurred_on?: string | null
          ocr_raw?: Json | null
          receipt_path?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      engineer_location_history: {
        Row: {
          engineer_id: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string
        }
        Insert: {
          engineer_id: string
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
        }
        Update: {
          engineer_id?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_location_history_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_payouts: {
        Row: {
          amount: number
          created_at: string
          engineer_id: string
          id: string
          job_id: string | null
          notes: string | null
          payout_method: string | null
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          engineer_id: string
          id?: string
          job_id?: string | null
          notes?: string | null
          payout_method?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          engineer_id?: string
          id?: string
          job_id?: string | null
          notes?: string | null
          payout_method?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_payouts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_payouts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_rate_cards: {
        Row: {
          after_hours_rate: number
          created_at: string
          created_by: string | null
          currency: string
          emergency_multiplier: number
          holiday_rate: number
          hourly_rate: number
          id: string
          is_active: boolean
          level: string
          level_name: string
          min_hours: number
          notes: string | null
          overtime_rate: number
          partner_id: string | null
          region_id: string | null
          scope_items: Json
          scope_of_work: string
          travel_rate: number
          updated_at: string
          weekend_rate: number
        }
        Insert: {
          after_hours_rate?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          emergency_multiplier?: number
          holiday_rate?: number
          hourly_rate?: number
          id?: string
          is_active?: boolean
          level?: string
          level_name?: string
          min_hours?: number
          notes?: string | null
          overtime_rate?: number
          partner_id?: string | null
          region_id?: string | null
          scope_items?: Json
          scope_of_work?: string
          travel_rate?: number
          updated_at?: string
          weekend_rate?: number
        }
        Update: {
          after_hours_rate?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          emergency_multiplier?: number
          holiday_rate?: number
          hourly_rate?: number
          id?: string
          is_active?: boolean
          level?: string
          level_name?: string
          min_hours?: number
          notes?: string | null
          overtime_rate?: number
          partner_id?: string | null
          region_id?: string | null
          scope_items?: Json
          scope_of_work?: string
          travel_rate?: number
          updated_at?: string
          weekend_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "engineer_rate_cards_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_rate_cards_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_ratings: {
        Row: {
          client_id: string
          created_at: string
          engineer_id: string
          id: string
          job_id: string
          rating: number
          review: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          engineer_id: string
          id?: string
          job_id: string
          rating: number
          review?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          engineer_id?: string
          id?: string
          job_id?: string
          rating?: number
          review?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engineer_ratings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_ratings_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_ratings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_ratings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_sos_events: {
        Row: {
          created_at: string
          engineer_id: string
          id: string
          job_id: string | null
          lat: number | null
          lng: number | null
          note: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          created_at?: string
          engineer_id: string
          id?: string
          job_id?: string | null
          lat?: number | null
          lng?: number | null
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          created_at?: string
          engineer_id?: string
          id?: string
          job_id?: string | null
          lat?: number | null
          lng?: number | null
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: []
      }
      engineer_success_scores: {
        Row: {
          avg_rating: number
          backout_score: number
          buyer_satisfaction_score: number
          created_at: string
          early_backout_count: number
          engineer_id: string
          id: string
          last_calculated_at: string
          late_backout_count: number
          late_count: number
          no_show_count: number
          on_time_count: number
          rating_count: number
          success_score: number
          tier: string
          timeliness_score: number
          total_assignments: number
          updated_at: string
        }
        Insert: {
          avg_rating?: number
          backout_score?: number
          buyer_satisfaction_score?: number
          created_at?: string
          early_backout_count?: number
          engineer_id: string
          id?: string
          last_calculated_at?: string
          late_backout_count?: number
          late_count?: number
          no_show_count?: number
          on_time_count?: number
          rating_count?: number
          success_score?: number
          tier?: string
          timeliness_score?: number
          total_assignments?: number
          updated_at?: string
        }
        Update: {
          avg_rating?: number
          backout_score?: number
          buyer_satisfaction_score?: number
          created_at?: string
          early_backout_count?: number
          engineer_id?: string
          id?: string
          last_calculated_at?: string
          late_backout_count?: number
          late_count?: number
          no_show_count?: number
          on_time_count?: number
          rating_count?: number
          success_score?: number
          tier?: string
          timeliness_score?: number
          total_assignments?: number
          updated_at?: string
        }
        Relationships: []
      }
      engineers: {
        Row: {
          application_review_note: string | null
          application_reviewed_at: string | null
          application_reviewed_by: string | null
          application_status: string
          application_submitted_at: string
          certification: string | null
          certifications: string[]
          city: string | null
          country: string | null
          created_at: string
          documents_reviewed: boolean
          documents_reviewed_at: string | null
          documents_reviewed_by: string | null
          email: string | null
          employee_id: string | null
          engineer_type: string
          full_name: string | null
          hourly_rate: number | null
          id: string
          id_card_url: string | null
          id_document_back_data: string | null
          id_document_back_name: string | null
          id_document_front_data: string | null
          id_document_front_name: string | null
          id_type: string | null
          identity_review_note: string | null
          identity_reviewed_at: string | null
          identity_reviewed_by: string | null
          identity_selfie_url: string | null
          identity_status: string
          identity_submitted_at: string | null
          insurance_details: string | null
          insurance_document_url: string | null
          insurance_expiry_date: string | null
          insurance_verified: boolean
          insurance_verified_at: string | null
          insurance_verified_by: string | null
          is_available: boolean | null
          jobs_completed: number | null
          latitude: number | null
          location: string | null
          longitude: number | null
          nda_signed: boolean
          nda_signed_at: string | null
          phone: string | null
          postcode: string | null
          rate_amount: number | null
          rate_currency: string
          rate_type: string
          rates: Json
          rating: number | null
          region_id: string | null
          residential_address: string | null
          show_email: boolean
          show_insurance: boolean
          show_phone: boolean
          show_vehicle: boolean
          skills: string[]
          source_recruiter: string | null
          specialty: string | null
          state: string | null
          updated_at: string
          user_id: string | null
          vehicle_number_plate: string | null
          vehicle_verified: boolean
          vehicle_verified_at: string | null
          vehicle_verified_by: string | null
          vendor_partner: string | null
        }
        Insert: {
          application_review_note?: string | null
          application_reviewed_at?: string | null
          application_reviewed_by?: string | null
          application_status?: string
          application_submitted_at?: string
          certification?: string | null
          certifications?: string[]
          city?: string | null
          country?: string | null
          created_at?: string
          documents_reviewed?: boolean
          documents_reviewed_at?: string | null
          documents_reviewed_by?: string | null
          email?: string | null
          employee_id?: string | null
          engineer_type?: string
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          id_card_url?: string | null
          id_document_back_data?: string | null
          id_document_back_name?: string | null
          id_document_front_data?: string | null
          id_document_front_name?: string | null
          id_type?: string | null
          identity_review_note?: string | null
          identity_reviewed_at?: string | null
          identity_reviewed_by?: string | null
          identity_selfie_url?: string | null
          identity_status?: string
          identity_submitted_at?: string | null
          insurance_details?: string | null
          insurance_document_url?: string | null
          insurance_expiry_date?: string | null
          insurance_verified?: boolean
          insurance_verified_at?: string | null
          insurance_verified_by?: string | null
          is_available?: boolean | null
          jobs_completed?: number | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          nda_signed?: boolean
          nda_signed_at?: string | null
          phone?: string | null
          postcode?: string | null
          rate_amount?: number | null
          rate_currency?: string
          rate_type?: string
          rates?: Json
          rating?: number | null
          region_id?: string | null
          residential_address?: string | null
          show_email?: boolean
          show_insurance?: boolean
          show_phone?: boolean
          show_vehicle?: boolean
          skills?: string[]
          source_recruiter?: string | null
          specialty?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_number_plate?: string | null
          vehicle_verified?: boolean
          vehicle_verified_at?: string | null
          vehicle_verified_by?: string | null
          vendor_partner?: string | null
        }
        Update: {
          application_review_note?: string | null
          application_reviewed_at?: string | null
          application_reviewed_by?: string | null
          application_status?: string
          application_submitted_at?: string
          certification?: string | null
          certifications?: string[]
          city?: string | null
          country?: string | null
          created_at?: string
          documents_reviewed?: boolean
          documents_reviewed_at?: string | null
          documents_reviewed_by?: string | null
          email?: string | null
          employee_id?: string | null
          engineer_type?: string
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          id_card_url?: string | null
          id_document_back_data?: string | null
          id_document_back_name?: string | null
          id_document_front_data?: string | null
          id_document_front_name?: string | null
          id_type?: string | null
          identity_review_note?: string | null
          identity_reviewed_at?: string | null
          identity_reviewed_by?: string | null
          identity_selfie_url?: string | null
          identity_status?: string
          identity_submitted_at?: string | null
          insurance_details?: string | null
          insurance_document_url?: string | null
          insurance_expiry_date?: string | null
          insurance_verified?: boolean
          insurance_verified_at?: string | null
          insurance_verified_by?: string | null
          is_available?: boolean | null
          jobs_completed?: number | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          nda_signed?: boolean
          nda_signed_at?: string | null
          phone?: string | null
          postcode?: string | null
          rate_amount?: number | null
          rate_currency?: string
          rate_type?: string
          rates?: Json
          rating?: number | null
          region_id?: string | null
          residential_address?: string | null
          show_email?: boolean
          show_insurance?: boolean
          show_phone?: boolean
          show_vehicle?: boolean
          skills?: string[]
          source_recruiter?: string | null
          specialty?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_number_plate?: string | null
          vehicle_verified?: boolean
          vehicle_verified_at?: string | null
          vehicle_verified_by?: string | null
          vendor_partner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engineers_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_approval_rule_steps: {
        Row: {
          created_at: string
          id: string
          name: string | null
          required_role: Database["public"]["Enums"]["app_role"]
          rule_id: string
          step_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          required_role: Database["public"]["Enums"]["app_role"]
          rule_id: string
          step_order: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          required_role?: Database["public"]["Enums"]["app_role"]
          rule_id?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_approval_rule_steps_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "estimate_approval_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_approval_rules: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string | null
          id: string
          is_active: boolean
          max_total: number | null
          min_total: number
          name: string
          priority: number
          required_role: Database["public"]["Enums"]["app_role"]
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean
          max_total?: number | null
          min_total?: number
          name: string
          priority?: number
          required_role?: Database["public"]["Enums"]["app_role"]
          scope?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean
          max_total?: number | null
          min_total?: number
          name?: string
          priority?: number
          required_role?: Database["public"]["Enums"]["app_role"]
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      estimate_approvals: {
        Row: {
          approver_id: string | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          estimate_id: string
          id: string
          required_role: Database["public"]["Enums"]["app_role"]
          rule_id: string | null
          status: string
          step_name: string | null
          step_order: number | null
          total_steps: number | null
          updated_at: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          estimate_id: string
          id?: string
          required_role: Database["public"]["Enums"]["app_role"]
          rule_id?: string | null
          status?: string
          step_name?: string | null
          step_order?: number | null
          total_steps?: number | null
          updated_at?: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          estimate_id?: string
          id?: string
          required_role?: Database["public"]["Enums"]["app_role"]
          rule_id?: string | null
          status?: string
          step_name?: string | null
          step_order?: number | null
          total_steps?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_approvals_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_approvals_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "estimate_approval_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_branding: {
        Row: {
          accent_color: string
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          company_website: string | null
          created_at: string
          footer_text: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          primary_color: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          footer_text?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          primary_color?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          footer_text?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          primary_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      estimate_line_items: {
        Row: {
          created_at: string
          description: string
          estimate_id: string
          id: string
          quantity: number
          sort_order: number
          tax1_rate: number
          tax2_rate: number
          total: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          estimate_id: string
          id?: string
          quantity?: number
          sort_order?: number
          tax1_rate?: number
          tax2_rate?: number
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          estimate_id?: string
          id?: string
          quantity?: number
          sort_order?: number
          tax1_rate?: number
          tax2_rate?: number
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_notes_template_versions: {
        Row: {
          change_note: string | null
          changed_by: string | null
          content: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          template_id: string
          version: number
          visibility: string
        }
        Insert: {
          change_note?: string | null
          changed_by?: string | null
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          template_id: string
          version: number
          visibility?: string
        }
        Update: {
          change_note?: string | null
          changed_by?: string | null
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          template_id?: string
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_notes_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "estimate_notes_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_notes_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
          version: number
          visibility: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          version?: number
          visibility?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          version?: number
          visibility?: string
        }
        Relationships: []
      }
      estimate_templates: {
        Row: {
          branding_accent_color: string | null
          branding_company_name: string | null
          branding_enabled: boolean
          branding_footer_text: string | null
          branding_logo_url: string | null
          branding_primary_color: string | null
          created_at: string
          currency: string
          custom_columns: Json
          default_title: string | null
          description: string | null
          discount_percent: number
          dispatch_full_day: number | null
          dispatch_half_day: number | null
          dispatch_hourly: number | null
          dispatch_nbd_tm: number | null
          dispatch_remarks: string | null
          dispatch_sbd_full_day: number | null
          dispatch_sbd_half_day: number | null
          dispatch_sbd_hourly: number | null
          dispatch_sbd_tm: number | null
          id: string
          is_shared: boolean
          line_items: Json
          name: string
          notes: string | null
          owner_id: string
          tax_mode: string
          tax1_label: string
          tax1_rate: number
          tax2_label: string
          tax2_rate: number
          updated_at: string
          valid_for_days: number | null
        }
        Insert: {
          branding_accent_color?: string | null
          branding_company_name?: string | null
          branding_enabled?: boolean
          branding_footer_text?: string | null
          branding_logo_url?: string | null
          branding_primary_color?: string | null
          created_at?: string
          currency?: string
          custom_columns?: Json
          default_title?: string | null
          description?: string | null
          discount_percent?: number
          dispatch_full_day?: number | null
          dispatch_half_day?: number | null
          dispatch_hourly?: number | null
          dispatch_nbd_tm?: number | null
          dispatch_remarks?: string | null
          dispatch_sbd_full_day?: number | null
          dispatch_sbd_half_day?: number | null
          dispatch_sbd_hourly?: number | null
          dispatch_sbd_tm?: number | null
          id?: string
          is_shared?: boolean
          line_items?: Json
          name: string
          notes?: string | null
          owner_id: string
          tax_mode?: string
          tax1_label?: string
          tax1_rate?: number
          tax2_label?: string
          tax2_rate?: number
          updated_at?: string
          valid_for_days?: number | null
        }
        Update: {
          branding_accent_color?: string | null
          branding_company_name?: string | null
          branding_enabled?: boolean
          branding_footer_text?: string | null
          branding_logo_url?: string | null
          branding_primary_color?: string | null
          created_at?: string
          currency?: string
          custom_columns?: Json
          default_title?: string | null
          description?: string | null
          discount_percent?: number
          dispatch_full_day?: number | null
          dispatch_half_day?: number | null
          dispatch_hourly?: number | null
          dispatch_nbd_tm?: number | null
          dispatch_remarks?: string | null
          dispatch_sbd_full_day?: number | null
          dispatch_sbd_half_day?: number | null
          dispatch_sbd_hourly?: number | null
          dispatch_sbd_tm?: number | null
          id?: string
          is_shared?: boolean
          line_items?: Json
          name?: string
          notes?: string | null
          owner_id?: string
          tax_mode?: string
          tax1_label?: string
          tax1_rate?: number
          tax2_label?: string
          tax2_rate?: number
          updated_at?: string
          valid_for_days?: number | null
        }
        Relationships: []
      }
      estimates: {
        Row: {
          branding_accent_color: string | null
          branding_company_name: string | null
          branding_footer_text: string | null
          branding_logo_url: string | null
          branding_primary_color: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          discount_amount: number
          discount_percent: number
          dispatch_full_day: number | null
          dispatch_half_day: number | null
          dispatch_hourly: number | null
          dispatch_nbd_tm: number | null
          dispatch_remarks: string | null
          dispatch_sbd_full_day: number | null
          dispatch_sbd_half_day: number | null
          dispatch_sbd_hourly: number | null
          dispatch_sbd_tm: number | null
          estimate_number: string | null
          id: string
          job_id: string | null
          notes: string | null
          partner_id: string | null
          signature_data: string | null
          signed_at: string | null
          signed_by: string | null
          status: Database["public"]["Enums"]["estimate_status"]
          subtotal: number
          tax_amount: number
          tax_mode: Database["public"]["Enums"]["tax_mode"]
          tax_rate: number
          tax1_label: string
          tax2_amount: number
          tax2_label: string
          tax2_rate: number
          title: string | null
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          branding_accent_color?: string | null
          branding_company_name?: string | null
          branding_footer_text?: string | null
          branding_logo_url?: string | null
          branding_primary_color?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          discount_percent?: number
          dispatch_full_day?: number | null
          dispatch_half_day?: number | null
          dispatch_hourly?: number | null
          dispatch_nbd_tm?: number | null
          dispatch_remarks?: string | null
          dispatch_sbd_full_day?: number | null
          dispatch_sbd_half_day?: number | null
          dispatch_sbd_hourly?: number | null
          dispatch_sbd_tm?: number | null
          estimate_number?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          partner_id?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number
          tax_amount?: number
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          tax_rate?: number
          tax1_label?: string
          tax2_amount?: number
          tax2_label?: string
          tax2_rate?: number
          title?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          branding_accent_color?: string | null
          branding_company_name?: string | null
          branding_footer_text?: string | null
          branding_logo_url?: string | null
          branding_primary_color?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          discount_percent?: number
          dispatch_full_day?: number | null
          dispatch_half_day?: number | null
          dispatch_hourly?: number | null
          dispatch_nbd_tm?: number | null
          dispatch_remarks?: string | null
          dispatch_sbd_full_day?: number | null
          dispatch_sbd_half_day?: number | null
          dispatch_sbd_hourly?: number | null
          dispatch_sbd_tm?: number | null
          estimate_number?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          partner_id?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number
          tax_amount?: number
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          tax_rate?: number
          tax1_label?: string
          tax2_amount?: number
          tax2_label?: string
          tax2_rate?: number
          title?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_logs: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          fuel_cost: number | null
          fuel_gallons: number | null
          id: string
          log_type: string
          maintenance_cost: number | null
          maintenance_type: string | null
          notes: string | null
          odometer: number | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          fuel_cost?: number | null
          fuel_gallons?: number | null
          id?: string
          log_type?: string
          maintenance_cost?: number | null
          maintenance_type?: string | null
          notes?: string | null
          odometer?: number | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          fuel_cost?: number | null
          fuel_gallons?: number | null
          id?: string
          log_type?: string
          maintenance_cost?: number | null
          maintenance_type?: string | null
          notes?: string | null
          odometer?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicles: {
        Row: {
          assigned_engineer_id: string | null
          created_at: string
          fuel_type: string
          id: string
          insurance_expiry: string | null
          license_plate: string
          make: string | null
          model: string | null
          next_service_date: string | null
          notes: string | null
          odometer_reading: number
          registration_expiry: string | null
          status: string
          updated_at: string
          vehicle_name: string
          vin: string | null
          year: number | null
        }
        Insert: {
          assigned_engineer_id?: string | null
          created_at?: string
          fuel_type?: string
          id?: string
          insurance_expiry?: string | null
          license_plate: string
          make?: string | null
          model?: string | null
          next_service_date?: string | null
          notes?: string | null
          odometer_reading?: number
          registration_expiry?: string | null
          status?: string
          updated_at?: string
          vehicle_name: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          assigned_engineer_id?: string | null
          created_at?: string
          fuel_type?: string
          id?: string
          insurance_expiry?: string | null
          license_plate?: string
          make?: string | null
          model?: string | null
          next_service_date?: string | null
          notes?: string | null
          odometer_reading?: number
          registration_expiry?: string | null
          status?: string
          updated_at?: string
          vehicle_name?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicles_assigned_engineer_id_fkey"
            columns: ["assigned_engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_reminders: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          is_completed: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          is_completed?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          is_completed?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          client_id: string | null
          created_at: string
          engineer_id: string | null
          id: string
          job_id: string | null
          responses: Json
          status: string
          submitted_at: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          engineer_id?: string | null
          id?: string
          job_id?: string | null
          responses?: Json
          status?: string
          submitted_at?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          engineer_id?: string | null
          id?: string
          job_id?: string | null
          responses?: Json
          status?: string
          submitted_at?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      geofence_events: {
        Row: {
          created_at: string
          distance_meters: number
          engineer_id: string
          event_type: string
          id: string
          job_id: string
          latitude: number
          longitude: number
        }
        Insert: {
          created_at?: string
          distance_meters: number
          engineer_id: string
          event_type: string
          id?: string
          job_id: string
          latitude: number
          longitude: number
        }
        Update: {
          created_at?: string
          distance_meters?: number
          engineer_id?: string
          event_type?: string
          id?: string
          job_id?: string
          latitude?: number
          longitude?: number
        }
        Relationships: [
          {
            foreignKeyName: "geofence_events_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      help_path_aliases: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          path: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          path: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          path?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      help_tooltips: {
        Row: {
          created_at: string
          display_type: string
          element_key: string
          help_article_id: string | null
          hint_text: string | null
          id: string
          is_active: boolean
          page_route: string
          tooltip_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_type?: string
          element_key: string
          help_article_id?: string | null
          hint_text?: string | null
          id?: string
          is_active?: boolean
          page_route: string
          tooltip_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_type?: string
          element_key?: string
          help_article_id?: string | null
          hint_text?: string | null
          id?: string
          is_active?: boolean
          page_route?: string
          tooltip_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_tooltips_help_article_id_fkey"
            columns: ["help_article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          assigned_engineer_id: string | null
          assigned_job_id: string | null
          category: string
          created_at: string
          id: string
          location: string | null
          min_stock_level: number
          name: string
          notes: string | null
          quantity: number
          serial_number: string | null
          status: string
          unit_cost: number | null
          updated_at: string
          warehouse: string | null
        }
        Insert: {
          assigned_engineer_id?: string | null
          assigned_job_id?: string | null
          category?: string
          created_at?: string
          id?: string
          location?: string | null
          min_stock_level?: number
          name: string
          notes?: string | null
          quantity?: number
          serial_number?: string | null
          status?: string
          unit_cost?: number | null
          updated_at?: string
          warehouse?: string | null
        }
        Update: {
          assigned_engineer_id?: string | null
          assigned_job_id?: string | null
          category?: string
          created_at?: string
          id?: string
          location?: string | null
          min_stock_level?: number
          name?: string
          notes?: string | null
          quantity?: number
          serial_number?: string | null
          status?: string
          unit_cost?: number | null
          updated_at?: string
          warehouse?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_assigned_engineer_id_fkey"
            columns: ["assigned_engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_assigned_job_id_fkey"
            columns: ["assigned_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_assigned_job_id_fkey"
            columns: ["assigned_job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          tax1_rate: number
          tax2_rate: number
          total: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          tax1_rate?: number
          tax2_rate?: number
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          tax1_rate?: number
          tax2_rate?: number
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          balance_due: number | null
          branding_accent_color: string | null
          branding_company_name: string | null
          branding_footer_text: string | null
          branding_logo_url: string | null
          branding_primary_color: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          discount_amount: number
          discount_percent: number
          dispatch_full_day: number | null
          dispatch_half_day: number | null
          dispatch_hourly: number | null
          dispatch_nbd_tm: number | null
          dispatch_remarks: string | null
          dispatch_sbd_full_day: number | null
          dispatch_sbd_half_day: number | null
          dispatch_sbd_hourly: number | null
          dispatch_sbd_tm: number | null
          due_date: string | null
          estimate_id: string | null
          estimate_link_active: boolean
          id: string
          invoice_number: string
          job_id: string | null
          notes: string | null
          paid_at: string | null
          partner_id: string | null
          payment_method: string | null
          purchase_order_number: string | null
          sent_at: string | null
          signature_data: string | null
          signed_at: string | null
          signed_by: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tax_enabled: boolean
          tax_mode: Database["public"]["Enums"]["tax_mode"]
          tax_preset: string | null
          tax_rate: number
          tax1_label: string
          tax2_amount: number
          tax2_label: string
          tax2_rate: number
          title: string | null
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          balance_due?: number | null
          branding_accent_color?: string | null
          branding_company_name?: string | null
          branding_footer_text?: string | null
          branding_logo_url?: string | null
          branding_primary_color?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          discount_percent?: number
          dispatch_full_day?: number | null
          dispatch_half_day?: number | null
          dispatch_hourly?: number | null
          dispatch_nbd_tm?: number | null
          dispatch_remarks?: string | null
          dispatch_sbd_full_day?: number | null
          dispatch_sbd_half_day?: number | null
          dispatch_sbd_hourly?: number | null
          dispatch_sbd_tm?: number | null
          due_date?: string | null
          estimate_id?: string | null
          estimate_link_active?: boolean
          id?: string
          invoice_number: string
          job_id?: string | null
          notes?: string | null
          paid_at?: string | null
          partner_id?: string | null
          payment_method?: string | null
          purchase_order_number?: string | null
          sent_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_enabled?: boolean
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          tax_preset?: string | null
          tax_rate?: number
          tax1_label?: string
          tax2_amount?: number
          tax2_label?: string
          tax2_rate?: number
          title?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          balance_due?: number | null
          branding_accent_color?: string | null
          branding_company_name?: string | null
          branding_footer_text?: string | null
          branding_logo_url?: string | null
          branding_primary_color?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          discount_percent?: number
          dispatch_full_day?: number | null
          dispatch_half_day?: number | null
          dispatch_hourly?: number | null
          dispatch_nbd_tm?: number | null
          dispatch_remarks?: string | null
          dispatch_sbd_full_day?: number | null
          dispatch_sbd_half_day?: number | null
          dispatch_sbd_hourly?: number | null
          dispatch_sbd_tm?: number | null
          due_date?: string | null
          estimate_id?: string | null
          estimate_link_active?: boolean
          id?: string
          invoice_number?: string
          job_id?: string | null
          notes?: string | null
          paid_at?: string | null
          partner_id?: string | null
          payment_method?: string | null
          purchase_order_number?: string | null
          sent_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_enabled?: boolean
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          tax_preset?: string | null
          tax_rate?: number
          tax1_label?: string
          tax2_amount?: number
          tax2_label?: string
          tax2_rate?: number
          title?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      job_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          field: string | null
          id: string
          job_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          job_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          job_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_activity_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_activity_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      job_attachments: {
        Row: {
          category: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          job_id: string
          mime_type: string | null
          uploaded_by: string
        }
        Insert: {
          category?: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          job_id: string
          mime_type?: string | null
          uploaded_by: string
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          job_id?: string
          mime_type?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_attachments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_attachments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      job_engineer_splits: {
        Row: {
          created_at: string
          engineer_id: string
          id: string
          job_id: string
          role: string | null
          share_percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          engineer_id: string
          id?: string
          job_id: string
          role?: string | null
          share_percent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          engineer_id?: string
          id?: string
          job_id?: string
          role?: string | null
          share_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_engineer_splits_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_engineer_splits_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_engineer_splits_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      job_events: {
        Row: {
          created_at: string
          engineer_id: string
          id: string
          job_id: string
          kind: string
          lat: number | null
          lng: number | null
          meta: Json
          occurred_at: string
        }
        Insert: {
          created_at?: string
          engineer_id: string
          id?: string
          job_id: string
          kind: string
          lat?: number | null
          lng?: number | null
          meta?: Json
          occurred_at?: string
        }
        Update: {
          created_at?: string
          engineer_id?: string
          id?: string
          job_id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          meta?: Json
          occurred_at?: string
        }
        Relationships: []
      }
      job_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_internal: boolean
          job_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          job_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          job_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      job_parts_used: {
        Row: {
          created_at: string
          description: string
          engineer_id: string
          id: string
          job_id: string
          notes: string | null
          qty: number
          unit: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          engineer_id: string
          id?: string
          job_id: string
          notes?: string | null
          qty?: number
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          engineer_id?: string
          id?: string
          job_id?: string
          notes?: string | null
          qty?: number
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      job_payout_claims: {
        Row: {
          amount: number
          claim_type: string
          created_at: string
          engineer_id: string
          id: string
          job_id: string
          note: string | null
          receipt_url: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          claim_type: string
          created_at?: string
          engineer_id: string
          id?: string
          job_id: string
          note?: string | null
          receipt_url?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          claim_type?: string
          created_at?: string
          engineer_id?: string
          id?: string
          job_id?: string
          note?: string | null
          receipt_url?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_payout_claims_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_payout_claims_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_payout_claims_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      job_reassignments: {
        Row: {
          created_at: string
          distance_km: number | null
          id: string
          job_id: string
          match_score: number | null
          new_engineer_id: string | null
          previous_engineer_id: string | null
          reason: string | null
          triggered_by: string | null
          triggered_kind: string
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          id?: string
          job_id: string
          match_score?: number | null
          new_engineer_id?: string | null
          previous_engineer_id?: string | null
          reason?: string | null
          triggered_by?: string | null
          triggered_kind?: string
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          id?: string
          job_id?: string
          match_score?: number | null
          new_engineer_id?: string | null
          previous_engineer_id?: string | null
          reason?: string | null
          triggered_by?: string | null
          triggered_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_reassignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_reassignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_reassignments_new_engineer_id_fkey"
            columns: ["new_engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_reassignments_previous_engineer_id_fkey"
            columns: ["previous_engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_recruiters: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          job_id: string
          recruiter_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          job_id: string
          recruiter_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          job_id?: string
          recruiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_recruiters_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_recruiters_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_recruiters_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_recruiters_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_by: string | null
          auto_reassign_enabled: boolean
          base_price: number | null
          client_id: string
          completed_at: string | null
          convenience_allowance: number
          created_at: string
          created_by: string | null
          currency: string
          delayed_at: string | null
          delayed_reason: string | null
          description: string | null
          engineer_charge: number | null
          engineer_id: string | null
          engineer_net: number
          food_allowance: number
          geofence_radius: number
          gross_payout: number
          id: string
          is_delayed: boolean
          last_reassigned_at: string | null
          latitude: number | null
          location: string
          longitude: number | null
          notes: string | null
          partner_cut: number
          partner_split_percent: number
          payout_approved_at: string | null
          payout_approved_by: string | null
          payout_paid_amount: number
          payout_paid_at: string | null
          payout_paid_by: string | null
          payout_status: Database["public"]["Enums"]["payout_status"]
          platform_cut: number
          platform_margin: number | null
          platform_split_percent: number
          previous_engineer_ids: string[]
          priority: Database["public"]["Enums"]["job_priority"]
          reassign_count: number
          reassign_grace_minutes: number
          region_id: string | null
          required_skills: string[]
          scheduled_at: string | null
          service_type: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          total_price: number | null
          transport_allowance: number
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          auto_reassign_enabled?: boolean
          base_price?: number | null
          client_id: string
          completed_at?: string | null
          convenience_allowance?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          delayed_at?: string | null
          delayed_reason?: string | null
          description?: string | null
          engineer_charge?: number | null
          engineer_id?: string | null
          engineer_net?: number
          food_allowance?: number
          geofence_radius?: number
          gross_payout?: number
          id?: string
          is_delayed?: boolean
          last_reassigned_at?: string | null
          latitude?: number | null
          location: string
          longitude?: number | null
          notes?: string | null
          partner_cut?: number
          partner_split_percent?: number
          payout_approved_at?: string | null
          payout_approved_by?: string | null
          payout_paid_amount?: number
          payout_paid_at?: string | null
          payout_paid_by?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          platform_cut?: number
          platform_margin?: number | null
          platform_split_percent?: number
          previous_engineer_ids?: string[]
          priority?: Database["public"]["Enums"]["job_priority"]
          reassign_count?: number
          reassign_grace_minutes?: number
          region_id?: string | null
          required_skills?: string[]
          scheduled_at?: string | null
          service_type: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          total_price?: number | null
          transport_allowance?: number
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          auto_reassign_enabled?: boolean
          base_price?: number | null
          client_id?: string
          completed_at?: string | null
          convenience_allowance?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          delayed_at?: string | null
          delayed_reason?: string | null
          description?: string | null
          engineer_charge?: number | null
          engineer_id?: string | null
          engineer_net?: number
          food_allowance?: number
          geofence_radius?: number
          gross_payout?: number
          id?: string
          is_delayed?: boolean
          last_reassigned_at?: string | null
          latitude?: number | null
          location?: string
          longitude?: number | null
          notes?: string | null
          partner_cut?: number
          partner_split_percent?: number
          payout_approved_at?: string | null
          payout_approved_by?: string | null
          payout_paid_amount?: number
          payout_paid_at?: string | null
          payout_paid_by?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          platform_cut?: number
          platform_margin?: number | null
          platform_split_percent?: number
          previous_engineer_ids?: string[]
          priority?: Database["public"]["Enums"]["job_priority"]
          reassign_count?: number
          reassign_grace_minutes?: number
          region_id?: string | null
          required_skills?: string[]
          scheduled_at?: string | null
          service_type?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          total_price?: number | null
          transport_allowance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_articles: {
        Row: {
          author_id: string | null
          category: string
          content: string
          created_at: string
          helpful_count: number
          id: string
          is_published: boolean
          tags: string[] | null
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          author_id?: string | null
          category?: string
          content?: string
          created_at?: string
          helpful_count?: number
          id?: string
          is_published?: boolean
          tags?: string[] | null
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          author_id?: string | null
          category?: string
          content?: string
          created_at?: string
          helpful_count?: number
          id?: string
          is_published?: boolean
          tags?: string[] | null
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      lead_pipeline: {
        Row: {
          assigned_to: string | null
          client_id: string
          created_at: string
          deal_value: number | null
          expected_close_date: string | null
          id: string
          notes: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_pipeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_applications: {
        Row: {
          application_type: string
          created_at: string
          engineer_id: string
          id: string
          job_id: string
          listing_id: string
          message: string | null
          proposed_pay: number | null
          proposed_start_at: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          application_type?: string
          created_at?: string
          engineer_id: string
          id?: string
          job_id: string
          listing_id: string
          message?: string | null
          proposed_pay?: number | null
          proposed_start_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          application_type?: string
          created_at?: string
          engineer_id?: string
          id?: string
          job_id?: string
          listing_id?: string
          message?: string | null
          proposed_pay?: number | null
          proposed_start_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_applications_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_applications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_applications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          convenience_allowance: number
          created_at: string
          engineer_net: number
          expires_at: string | null
          food_allowance: number
          gross_payout: number
          id: string
          job_id: string
          partner_cut: number
          partner_split_percent: number
          pay_negotiable: boolean
          payout_approved_at: string | null
          payout_approved_by: string | null
          payout_paid_amount: number
          payout_paid_at: string | null
          payout_paid_by: string | null
          payout_status: Database["public"]["Enums"]["payout_status"]
          platform_cut: number
          platform_split_percent: number
          posted_by: string | null
          posted_pay: number | null
          required_certifications: string[]
          required_skills: string[]
          status: string
          transport_allowance: number
          updated_at: string
          view_count: number
          visibility: string
        }
        Insert: {
          convenience_allowance?: number
          created_at?: string
          engineer_net?: number
          expires_at?: string | null
          food_allowance?: number
          gross_payout?: number
          id?: string
          job_id: string
          partner_cut?: number
          partner_split_percent?: number
          pay_negotiable?: boolean
          payout_approved_at?: string | null
          payout_approved_by?: string | null
          payout_paid_amount?: number
          payout_paid_at?: string | null
          payout_paid_by?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          platform_cut?: number
          platform_split_percent?: number
          posted_by?: string | null
          posted_pay?: number | null
          required_certifications?: string[]
          required_skills?: string[]
          status?: string
          transport_allowance?: number
          updated_at?: string
          view_count?: number
          visibility?: string
        }
        Update: {
          convenience_allowance?: number
          created_at?: string
          engineer_net?: number
          expires_at?: string | null
          food_allowance?: number
          gross_payout?: number
          id?: string
          job_id?: string
          partner_cut?: number
          partner_split_percent?: number
          pay_negotiable?: boolean
          payout_approved_at?: string | null
          payout_approved_by?: string | null
          payout_paid_amount?: number
          payout_paid_at?: string | null
          payout_paid_by?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          platform_cut?: number
          platform_split_percent?: number
          posted_by?: string | null
          posted_pay?: number | null
          required_certifications?: string[]
          required_skills?: string[]
          status?: string
          transport_allowance?: number
          updated_at?: string
          view_count?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_room_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_digest_enabled: boolean
          email_digest_frequency: string
          escalation: boolean
          estimate_update: boolean
          id: string
          invoice_update: boolean
          job_assigned: boolean
          job_cancelled: boolean
          job_reassigned: boolean
          job_status_change: boolean
          new_ticket: boolean
          push_role_admin: boolean
          push_role_client: boolean
          push_role_engineer: boolean
          push_role_team_lead: boolean
          quiet_hours_allow_critical: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          sla_breach: boolean
          sla_risk: boolean
          ticket_update: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_digest_enabled?: boolean
          email_digest_frequency?: string
          escalation?: boolean
          estimate_update?: boolean
          id?: string
          invoice_update?: boolean
          job_assigned?: boolean
          job_cancelled?: boolean
          job_reassigned?: boolean
          job_status_change?: boolean
          new_ticket?: boolean
          push_role_admin?: boolean
          push_role_client?: boolean
          push_role_engineer?: boolean
          push_role_team_lead?: boolean
          quiet_hours_allow_critical?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          sla_breach?: boolean
          sla_risk?: boolean
          ticket_update?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_digest_enabled?: boolean
          email_digest_frequency?: string
          escalation?: boolean
          estimate_update?: boolean
          id?: string
          invoice_update?: boolean
          job_assigned?: boolean
          job_cancelled?: boolean
          job_reassigned?: boolean
          job_status_change?: boolean
          new_ticket?: boolean
          push_role_admin?: boolean
          push_role_client?: boolean
          push_role_engineer?: boolean
          push_role_team_lead?: boolean
          quiet_hours_allow_critical?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          sla_breach?: boolean
          sla_risk?: boolean
          ticket_update?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          address_line1: string | null
          billing_contact_email: string | null
          billing_contact_name: string | null
          billing_contact_phone: string | null
          city: string | null
          commission_rate: number | null
          company_name: string
          contact_name: string
          country: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          logo_url: string | null
          payment_account_name: string | null
          payment_bank_name_address: string | null
          payment_iban: string | null
          payment_swift_bic: string | null
          phone: string | null
          postcode: string | null
          region: string | null
          tax_number: string | null
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          city?: string | null
          commission_rate?: number | null
          company_name: string
          contact_name: string
          country?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          payment_account_name?: string | null
          payment_bank_name_address?: string | null
          payment_iban?: string | null
          payment_swift_bic?: string | null
          phone?: string | null
          postcode?: string | null
          region?: string | null
          tax_number?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          city?: string | null
          commission_rate?: number | null
          company_name?: string
          contact_name?: string
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          payment_account_name?: string | null
          payment_bank_name_address?: string | null
          payment_iban?: string | null
          payment_swift_bic?: string | null
          phone?: string | null
          postcode?: string | null
          region?: string | null
          tax_number?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      pending_engineer_approvals: {
        Row: {
          assigned_admin_email: string | null
          assigned_admin_id: string | null
          certification: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          id_document_back_data: string | null
          id_document_back_name: string | null
          id_document_front_data: string | null
          id_document_front_name: string | null
          id_type: string | null
          phone: string | null
          residential_address: string | null
          status: string
          user_id: string
        }
        Insert: {
          assigned_admin_email?: string | null
          assigned_admin_id?: string | null
          certification?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          id_document_back_data?: string | null
          id_document_back_name?: string | null
          id_document_front_data?: string | null
          id_document_front_name?: string | null
          id_type?: string | null
          phone?: string | null
          residential_address?: string | null
          status?: string
          user_id: string
        }
        Update: {
          assigned_admin_email?: string | null
          assigned_admin_id?: string | null
          certification?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          id_document_back_data?: string | null
          id_document_back_name?: string | null
          id_document_front_data?: string | null
          id_document_front_name?: string | null
          id_type?: string | null
          phone?: string | null
          residential_address?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      po_accounting_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          entry_type: string
          fx_rate: number
          id: string
          paid_at: string
          payment_method: string | null
          po_id: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_type?: string
          fx_rate?: number
          id?: string
          paid_at?: string
          payment_method?: string | null
          po_id: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_type?: string
          fx_rate?: number
          id?: string
          paid_at?: string
          payment_method?: string | null
          po_id?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_accounting_entries_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_approvals: {
        Row: {
          approver_id: string | null
          created_at: string
          decided_at: string | null
          id: string
          po_id: string
          reason: string | null
          required_role: string
          status: string
          step_order: number
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          po_id: string
          reason?: string | null
          required_role?: string
          status?: string
          step_order?: number
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          po_id?: string
          reason?: string | null
          required_role?: string
          status?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_approvals_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          field: string | null
          id: string
          new_value: string | null
          note: string | null
          old_value: string | null
          po_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          po_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          po_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_audit_log_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_receipts: {
        Row: {
          created_at: string
          id: string
          is_partial: boolean
          items: Json
          notes: string | null
          po_id: string
          received_at: string
          received_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_partial?: boolean
          items?: Json
          notes?: string | null
          po_id: string
          received_at?: string
          received_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_partial?: boolean
          items?: Json
          notes?: string | null
          po_id?: string
          received_at?: string
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_presets: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          default_discount_percent: number
          default_quantity: number
          default_tax_rate: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          sku: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          default_discount_percent?: number
          default_quantity?: number
          default_tax_rate?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sku?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          default_discount_percent?: number
          default_quantity?: number
          default_tax_rate?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sku?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          base_price: number
          complexity_multiplier: number
          created_at: string
          id: string
          is_active: boolean
          max_price: number | null
          min_price: number
          region_id: string | null
          service_type: string
          updated_at: string
          urgency_multiplier_high: number
          urgency_multiplier_low: number
          urgency_multiplier_medium: number
          urgency_multiplier_urgent: number
        }
        Insert: {
          base_price?: number
          complexity_multiplier?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_price?: number | null
          min_price?: number
          region_id?: string | null
          service_type: string
          updated_at?: string
          urgency_multiplier_high?: number
          urgency_multiplier_low?: number
          urgency_multiplier_medium?: number
          urgency_multiplier_urgent?: number
        }
        Update: {
          base_price?: number
          complexity_multiplier?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_price?: number | null
          min_price?: number
          region_id?: string | null
          service_type?: string
          updated_at?: string
          urgency_multiplier_high?: number
          urgency_multiplier_low?: number
          urgency_multiplier_medium?: number
          urgency_multiplier_urgent?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_sites: {
        Row: {
          address: string | null
          city: string | null
          client_id: string | null
          completed_date: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          device_count: number | null
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          planned_date: string | null
          postal_code: string | null
          project_id: string
          site_code: string | null
          site_name: string
          state: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_id?: string | null
          completed_date?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          device_count?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          planned_date?: string | null
          postal_code?: string | null
          project_id: string
          site_code?: string | null
          site_name: string
          state?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          client_id?: string | null
          completed_date?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          device_count?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          planned_date?: string | null
          postal_code?: string | null
          project_id?: string
          site_code?: string | null
          site_name?: string
          state?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_end_date: string | null
          budget: number
          client_id: string
          code: string
          completed_sites: number
          created_at: string
          created_by: string | null
          currency: string
          deployed_devices: number
          description: string | null
          estimate_id: string | null
          id: string
          industry: string | null
          lead_user_id: string | null
          name: string
          notes: string | null
          partner_id: string | null
          project_type: string
          region_id: string | null
          start_date: string | null
          status: string
          target_end_date: string | null
          total_devices: number
          total_sites: number
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          budget?: number
          client_id: string
          code?: string
          completed_sites?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deployed_devices?: number
          description?: string | null
          estimate_id?: string | null
          id?: string
          industry?: string | null
          lead_user_id?: string | null
          name: string
          notes?: string | null
          partner_id?: string | null
          project_type?: string
          region_id?: string | null
          start_date?: string | null
          status?: string
          target_end_date?: string | null
          total_devices?: number
          total_sites?: number
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          budget?: number
          client_id?: string
          code?: string
          completed_sites?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deployed_devices?: number
          description?: string | null
          estimate_id?: string | null
          id?: string
          industry?: string | null
          lead_user_id?: string | null
          name?: string
          notes?: string | null
          partner_id?: string | null
          project_type?: string
          region_id?: string | null
          start_date?: string | null
          status?: string
          target_end_date?: string | null
          total_devices?: number
          total_sites?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      proof_points: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          sub: string | null
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          sub?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          sub?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          budget_code: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          discount_amount: number
          expected_delivery: string | null
          fx_rate: number
          id: string
          items: Json
          job_id: string | null
          notes: string | null
          ordered_at: string | null
          payment_terms: string | null
          po_number: string
          receive_status: string
          received_at: string | null
          shipping_cost: number
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          three_way_match_status: string | null
          total: number
          updated_at: string
          vendor_acknowledged_at: string | null
          vendor_email: string | null
          vendor_id: string | null
          vendor_invoice_number: string | null
          vendor_invoice_total: number | null
          vendor_name: string
          vendor_phone: string | null
          vendor_share_token: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          budget_code?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          expected_delivery?: string | null
          fx_rate?: number
          id?: string
          items?: Json
          job_id?: string | null
          notes?: string | null
          ordered_at?: string | null
          payment_terms?: string | null
          po_number?: string
          receive_status?: string
          received_at?: string | null
          shipping_cost?: number
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          three_way_match_status?: string | null
          total?: number
          updated_at?: string
          vendor_acknowledged_at?: string | null
          vendor_email?: string | null
          vendor_id?: string | null
          vendor_invoice_number?: string | null
          vendor_invoice_total?: number | null
          vendor_name: string
          vendor_phone?: string | null
          vendor_share_token?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          budget_code?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          expected_delivery?: string | null
          fx_rate?: number
          id?: string
          items?: Json
          job_id?: string | null
          notes?: string | null
          ordered_at?: string | null
          payment_terms?: string | null
          po_number?: string
          receive_status?: string
          received_at?: string | null
          shipping_cost?: number
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          three_way_match_status?: string | null
          total?: number
          updated_at?: string
          vendor_acknowledged_at?: string | null
          vendor_email?: string | null
          vendor_id?: string | null
          vendor_invoice_number?: string | null
          vendor_invoice_total?: number | null
          vendor_name?: string
          vendor_phone?: string | null
          vendor_share_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          failure_count: number
          id: string
          is_active: boolean
          last_failure_at: string | null
          last_seen_at: string
          last_success_at: string | null
          p256dh: string
          platform: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          failure_count?: number
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_seen_at?: string
          last_success_at?: string | null
          p256dh: string
          platform?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          failure_count?: number
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_seen_at?: string
          last_success_at?: string | null
          p256dh?: string
          platform?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pwa_install_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          platform: string
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          platform: string
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          platform?: string
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      receipt_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          quantity: number
          receipt_id: string
          sort_order: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          quantity?: number
          receipt_id: string
          sort_order?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          receipt_id?: string
          sort_order?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_line_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount_paid: number
          branding_accent_color: string | null
          branding_company_name: string | null
          branding_footer_text: string | null
          branding_logo_url: string | null
          branding_primary_color: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          discount_amount: number
          discount_percent: number
          id: string
          invoice_id: string | null
          kind: Database["public"]["Enums"]["receipt_kind"]
          notes: string | null
          paid_at: string
          partner_id: string | null
          payer_email: string | null
          payer_name: string | null
          payment_method: string | null
          payment_reference: string | null
          receipt_number: string
          recurrence: string | null
          recurrence_active: boolean
          recurrence_next_at: string | null
          refund_reason: string | null
          refunded_amount: number
          refunded_at: string | null
          subtotal: number
          tax_amount: number
          tax_mode: Database["public"]["Enums"]["tax_mode"]
          tax_rate: number
          tax1_label: string
          tax2_amount: number
          tax2_label: string
          tax2_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          branding_accent_color?: string | null
          branding_company_name?: string | null
          branding_footer_text?: string | null
          branding_logo_url?: string | null
          branding_primary_color?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          discount_percent?: number
          id?: string
          invoice_id?: string | null
          kind?: Database["public"]["Enums"]["receipt_kind"]
          notes?: string | null
          paid_at?: string
          partner_id?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          receipt_number: string
          recurrence?: string | null
          recurrence_active?: boolean
          recurrence_next_at?: string | null
          refund_reason?: string | null
          refunded_amount?: number
          refunded_at?: string | null
          subtotal?: number
          tax_amount?: number
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          tax_rate?: number
          tax1_label?: string
          tax2_amount?: number
          tax2_label?: string
          tax2_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          branding_accent_color?: string | null
          branding_company_name?: string | null
          branding_footer_text?: string | null
          branding_logo_url?: string | null
          branding_primary_color?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          discount_percent?: number
          id?: string
          invoice_id?: string | null
          kind?: Database["public"]["Enums"]["receipt_kind"]
          notes?: string | null
          paid_at?: string
          partner_id?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          receipt_number?: string
          recurrence?: string | null
          recurrence_active?: boolean
          recurrence_next_at?: string | null
          refund_reason?: string | null
          refunded_amount?: number
          refunded_at?: string | null
          subtotal?: number
          tax_amount?: number
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          tax_rate?: number
          tax1_label?: string
          tax2_amount?: number
          tax2_label?: string
          tax2_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_job_templates: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          engineer_id: string | null
          frequency: string
          id: string
          is_active: boolean
          last_run_at: string | null
          latitude: number | null
          location: string
          longitude: number | null
          next_run_at: string
          priority: Database["public"]["Enums"]["job_priority"]
          service_type: string
          template_data: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          engineer_id?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          latitude?: number | null
          location: string
          longitude?: number | null
          next_run_at?: string
          priority?: Database["public"]["Enums"]["job_priority"]
          service_type: string
          template_data?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          engineer_id?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          latitude?: number | null
          location?: string
          longitude?: number | null
          next_run_at?: string
          priority?: Database["public"]["Enums"]["job_priority"]
          service_type?: string
          template_data?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_job_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_job_templates_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_schedules: {
        Row: {
          created_at: string
          frequency: string
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          owner_id: string
          recipients: string[]
          saved_report_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          frequency: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          owner_id: string
          recipients?: string[]
          saved_report_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          owner_id?: string
          recipients?: string[]
          saved_report_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_saved_report_id_fkey"
            columns: ["saved_report_id"]
            isOneToOne: false
            referencedRelation: "saved_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      roi_funnel_events: {
        Row: {
          annual_savings_usd: number | null
          created_at: string
          duration: string | null
          event_type: string
          id: string
          metadata: Json
          monthly_jobs: number | null
          monthly_savings_usd: number | null
          savings_pct: number | null
          service_level: string | null
          session_id: string
          sla: string | null
          source: string | null
        }
        Insert: {
          annual_savings_usd?: number | null
          created_at?: string
          duration?: string | null
          event_type: string
          id?: string
          metadata?: Json
          monthly_jobs?: number | null
          monthly_savings_usd?: number | null
          savings_pct?: number | null
          service_level?: string | null
          session_id: string
          sla?: string | null
          source?: string | null
        }
        Update: {
          annual_savings_usd?: number | null
          created_at?: string
          duration?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          monthly_jobs?: number | null
          monthly_savings_usd?: number | null
          savings_pct?: number | null
          service_level?: string | null
          session_id?: string
          sla?: string | null
          source?: string | null
        }
        Relationships: []
      }
      saved_reports: {
        Row: {
          chart_type: string
          chart_x: string | null
          chart_y: string | null
          created_at: string
          date_from: string | null
          date_mode: string
          date_to: string | null
          description: string | null
          filters: Json
          id: string
          name: string
          owner_id: string
          report_type: string
          sort_column: string | null
          sort_direction: string
          updated_at: string
          visible_columns: string[]
        }
        Insert: {
          chart_type?: string
          chart_x?: string | null
          chart_y?: string | null
          created_at?: string
          date_from?: string | null
          date_mode?: string
          date_to?: string | null
          description?: string | null
          filters?: Json
          id?: string
          name: string
          owner_id: string
          report_type: string
          sort_column?: string | null
          sort_direction?: string
          updated_at?: string
          visible_columns?: string[]
        }
        Update: {
          chart_type?: string
          chart_x?: string | null
          chart_y?: string | null
          created_at?: string
          date_from?: string | null
          date_mode?: string
          date_to?: string | null
          description?: string | null
          filters?: Json
          id?: string
          name?: string
          owner_id?: string
          report_type?: string
          sort_column?: string | null
          sort_direction?: string
          updated_at?: string
          visible_columns?: string[]
        }
        Relationships: []
      }
      sd_wan_sites: {
        Row: {
          address: string | null
          city: string | null
          client_id: string
          country: string | null
          created_at: string
          created_by: string | null
          device_model: string | null
          go_live_date: string | null
          id: string
          install_date: string | null
          notes: string | null
          primary_circuit: string | null
          project_id: string | null
          secondary_circuit: string | null
          site_code: string | null
          site_name: string
          sla_tier: string
          status: string
          technology: string
          updated_at: string
          vendor: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_id: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          device_model?: string | null
          go_live_date?: string | null
          id?: string
          install_date?: string | null
          notes?: string | null
          primary_circuit?: string | null
          project_id?: string | null
          secondary_circuit?: string | null
          site_code?: string | null
          site_name: string
          sla_tier?: string
          status?: string
          technology?: string
          updated_at?: string
          vendor?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          client_id?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          device_model?: string | null
          go_live_date?: string | null
          id?: string
          install_date?: string | null
          notes?: string | null
          primary_circuit?: string | null
          project_id?: string | null
          secondary_circuit?: string | null
          site_code?: string | null
          site_name?: string
          sla_tier?: string
          status?: string
          technology?: string
          updated_at?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "sd_wan_sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sd_wan_sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      service_agreements: {
        Row: {
          agreement_type: string
          amount: number
          billing_frequency: string
          client_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          notes: string | null
          renewal_type: string
          start_date: string
          status: string
          terms: string | null
          title: string
          updated_at: string
          visits_included: number
          visits_used: number
        }
        Insert: {
          agreement_type?: string
          amount?: number
          billing_frequency?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          renewal_type?: string
          start_date?: string
          status?: string
          terms?: string | null
          title: string
          updated_at?: string
          visits_included?: number
          visits_used?: number
        }
        Update: {
          agreement_type?: string
          amount?: number
          billing_frequency?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          renewal_type?: string
          start_date?: string
          status?: string
          terms?: string | null
          title?: string
          updated_at?: string
          visits_included?: number
          visits_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_agreements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      service_desk_routing_rules: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          priority: number
          region: string | null
          service_category: string | null
          service_desk_team_id: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          region?: string | null
          service_category?: string | null
          service_desk_team_id: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          region?: string | null
          service_category?: string | null
          service_desk_team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_desk_routing_rules_service_desk_team_id_fkey"
            columns: ["service_desk_team_id"]
            isOneToOne: false
            referencedRelation: "service_desk_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      service_desk_teams: {
        Row: {
          chat_room_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          teams_channel_id: string | null
          teams_team_id: string | null
          updated_at: string
        }
        Insert: {
          chat_room_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          teams_channel_id?: string | null
          teams_team_id?: string | null
          updated_at?: string
        }
        Update: {
          chat_room_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          teams_channel_id?: string | null
          teams_team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_desk_teams_chat_room_id_fkey"
            columns: ["chat_room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          actual_delivery: string | null
          carrier: string | null
          created_at: string
          created_by: string | null
          destination: string
          estimated_delivery: string | null
          id: string
          items: Json | null
          job_id: string | null
          notes: string | null
          origin: string
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          actual_delivery?: string | null
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          destination: string
          estimated_delivery?: string | null
          id?: string
          items?: Json | null
          job_id?: string | null
          notes?: string | null
          origin: string
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          actual_delivery?: string | null
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string
          estimated_delivery?: string | null
          id?: string
          items?: Json | null
          job_id?: string | null
          notes?: string | null
          origin?: string
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      site_surveys: {
        Row: {
          checklist: Json | null
          client_id: string
          completed_at: string | null
          created_at: string
          engineer_id: string | null
          findings: string | null
          id: string
          job_id: string | null
          photo_annotations: Json
          photos: string[] | null
          recommendations: string | null
          status: string
          survey_type: string
          updated_at: string
        }
        Insert: {
          checklist?: Json | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          engineer_id?: string | null
          findings?: string | null
          id?: string
          job_id?: string | null
          photo_annotations?: Json
          photos?: string[] | null
          recommendations?: string | null
          status?: string
          survey_type?: string
          updated_at?: string
        }
        Update: {
          checklist?: Json | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          engineer_id?: string | null
          findings?: string | null
          id?: string
          job_id?: string | null
          photo_annotations?: Json
          photos?: string[] | null
          recommendations?: string | null
          status?: string
          survey_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_surveys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_surveys_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_surveys_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_surveys_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_breaches: {
        Row: {
          actual_minutes: number | null
          breach_type: string
          breached_at: string
          client_id: string
          created_at: string
          escalated_to: string | null
          escalation_status: string
          id: string
          job_id: string
          notes: string | null
          sla_policy_id: string
          target_minutes: number
          updated_at: string
        }
        Insert: {
          actual_minutes?: number | null
          breach_type?: string
          breached_at?: string
          client_id: string
          created_at?: string
          escalated_to?: string | null
          escalation_status?: string
          id?: string
          job_id: string
          notes?: string | null
          sla_policy_id: string
          target_minutes: number
          updated_at?: string
        }
        Update: {
          actual_minutes?: number | null
          breach_type?: string
          breached_at?: string
          client_id?: string
          created_at?: string
          escalated_to?: string | null
          escalation_status?: string
          id?: string
          job_id?: string
          notes?: string | null
          sla_policy_id?: string
          target_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_breaches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_breaches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_breaches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_breaches_sla_policy_id_fkey"
            columns: ["sla_policy_id"]
            isOneToOne: false
            referencedRelation: "sla_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          priority: Database["public"]["Enums"]["job_priority"]
          resolution_time_minutes: number
          response_time_minutes: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          priority?: Database["public"]["Enums"]["job_priority"]
          resolution_time_minutes?: number
          response_time_minutes?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          priority?: Database["public"]["Enums"]["job_priority"]
          resolution_time_minutes?: number
          response_time_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_match_alerts: {
        Row: {
          created_at: string
          engineer_id: string
          id: string
          job_id: string
          match_score: number
          search_id: string
        }
        Insert: {
          created_at?: string
          engineer_id: string
          id?: string
          job_id: string
          match_score?: number
          search_id: string
        }
        Update: {
          created_at?: string
          engineer_id?: string
          id?: string
          job_id?: string
          match_score?: number
          search_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_match_alerts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_match_alerts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_match_alerts_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "smart_match_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_match_searches: {
        Row: {
          created_at: string
          engineer_id: string
          id: string
          is_active: boolean
          max_distance_km: number | null
          min_pay: number | null
          name: string
          notify_email: boolean
          notify_push: boolean
          priorities: string[] | null
          region_ids: string[] | null
          required_skills: string[] | null
          service_types: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          engineer_id: string
          id?: string
          is_active?: boolean
          max_distance_km?: number | null
          min_pay?: number | null
          name: string
          notify_email?: boolean
          notify_push?: boolean
          priorities?: string[] | null
          region_ids?: string[] | null
          required_skills?: string[] | null
          service_types?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          engineer_id?: string
          id?: string
          is_active?: boolean
          max_distance_km?: number | null
          min_pay?: number | null
          name?: string
          notify_email?: boolean
          notify_push?: boolean
          priorities?: string[] | null
          region_ids?: string[] | null
          required_skills?: string[] | null
          service_types?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_match_searches_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      sow_contract_audit: {
        Row: {
          action: string
          actor_id: string | null
          contract_id: string
          created_at: string
          field: string | null
          id: string
          new_value: Json | null
          note: string | null
          old_value: Json | null
          version: number | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          contract_id: string
          created_at?: string
          field?: string | null
          id?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          version?: number | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          contract_id?: string
          created_at?: string
          field?: string | null
          id?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sow_contract_audit_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "sow_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      sow_contract_versions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          approved_at: string | null
          approved_by: string | null
          change_summary: string | null
          clauses: Json
          contract_id: string
          created_at: string
          created_by: string | null
          id: string
          meta: Json
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_at: string | null
          submitted_by: string | null
          version: number
          workflow_status: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          change_summary?: string | null
          clauses?: Json
          contract_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          meta?: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          version: number
          workflow_status?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          change_summary?: string | null
          clauses?: Json
          contract_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          meta?: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          version?: number
          workflow_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sow_contract_versions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "sow_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      sow_contracts: {
        Row: {
          client_name: string | null
          created_at: string
          current_version: number
          effective_date: string | null
          id: string
          owner_id: string | null
          reference: string
          status: string
          term: string | null
          title: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          current_version?: number
          effective_date?: string | null
          id?: string
          owner_id?: string | null
          reference: string
          status?: string
          term?: string | null
          title: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          client_name?: string | null
          created_at?: string
          current_version?: number
          effective_date?: string | null
          id?: string
          owner_id?: string | null
          reference?: string
          status?: string
          term?: string | null
          title?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: []
      }
      teams_inquiries: {
        Row: {
          body: string | null
          city: string | null
          country: string | null
          created_at: string
          error_message: string | null
          id: string
          matched_client_id: string | null
          matched_job_id: string | null
          raw_payload: Json | null
          region: string | null
          routed_team_id: string | null
          sender_email: string | null
          sender_name: string | null
          service_category: string | null
          source: string
          status: string
          subject: string | null
          teams_channel_id: string | null
          teams_message_id: string | null
          teams_team_id: string | null
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          matched_client_id?: string | null
          matched_job_id?: string | null
          raw_payload?: Json | null
          region?: string | null
          routed_team_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          service_category?: string | null
          source?: string
          status?: string
          subject?: string | null
          teams_channel_id?: string | null
          teams_message_id?: string | null
          teams_team_id?: string | null
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          matched_client_id?: string | null
          matched_job_id?: string | null
          raw_payload?: Json | null
          region?: string | null
          routed_team_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          service_category?: string | null
          source?: string
          status?: string
          subject?: string | null
          teams_channel_id?: string | null
          teams_message_id?: string | null
          teams_team_id?: string | null
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_inquiries_matched_client_id_fkey"
            columns: ["matched_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_inquiries_matched_job_id_fkey"
            columns: ["matched_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_inquiries_matched_job_id_fkey"
            columns: ["matched_job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_inquiries_routed_team_id_fkey"
            columns: ["routed_team_id"]
            isOneToOne: false
            referencedRelation: "service_desk_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_inquiries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          field: string | null
          id: string
          new_value: string | null
          note: string | null
          old_value: string | null
          source_message_id: string | null
          ticket_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          source_message_id?: string | null
          ticket_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          source_message_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_activity_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          chat_room_id: string | null
          client_id: string
          closed_at: string | null
          created_at: string
          description: string | null
          escalation_level: number
          escalation_max_level: number
          escalation_unanswered_minutes: number
          first_response_at: string | null
          id: string
          job_id: string | null
          last_escalated_at: string | null
          priority: Database["public"]["Enums"]["job_priority"]
          resolved_at: string | null
          sla_resolution_breached: boolean
          sla_resolution_due_at: string | null
          sla_response_breached: boolean
          sla_response_due_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          chat_room_id?: string | null
          client_id: string
          closed_at?: string | null
          created_at?: string
          description?: string | null
          escalation_level?: number
          escalation_max_level?: number
          escalation_unanswered_minutes?: number
          first_response_at?: string | null
          id?: string
          job_id?: string | null
          last_escalated_at?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          resolved_at?: string | null
          sla_resolution_breached?: boolean
          sla_resolution_due_at?: string | null
          sla_response_breached?: boolean
          sla_response_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          chat_room_id?: string | null
          client_id?: string
          closed_at?: string | null
          created_at?: string
          description?: string | null
          escalation_level?: number
          escalation_max_level?: number
          escalation_unanswered_minutes?: number
          first_response_at?: string | null
          id?: string
          job_id?: string | null
          last_escalated_at?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          resolved_at?: string | null
          sla_resolution_breached?: boolean
          sla_resolution_due_at?: string | null
          sla_response_breached?: boolean
          sla_response_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_chat_room_id_fkey"
            columns: ["chat_room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          break_minutes: number
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          engineer_id: string
          hourly_rate: number
          id: string
          job_id: string | null
          notes: string | null
          overtime_hours: number
          status: string
          total_hours: number
          total_pay: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          engineer_id: string
          hourly_rate?: number
          id?: string
          job_id?: string | null
          notes?: string | null
          overtime_hours?: number
          status?: string
          total_hours?: number
          total_pay?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          engineer_id?: string
          hourly_rate?: number
          id?: string
          job_id?: string | null
          notes?: string | null
          overtime_hours?: number
          status?: string
          total_hours?: number
          total_pay?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_price_history: {
        Row: {
          currency: string
          id: string
          item_description: string
          po_id: string | null
          quantity: number
          recorded_at: string
          unit_price: number
          vendor_id: string | null
          vendor_name: string
        }
        Insert: {
          currency?: string
          id?: string
          item_description: string
          po_id?: string | null
          quantity?: number
          recorded_at?: string
          unit_price: number
          vendor_id?: string | null
          vendor_name: string
        }
        Update: {
          currency?: string
          id?: string
          item_description?: string
          po_id?: string | null
          quantity?: number
          recorded_at?: string
          unit_price?: number
          vendor_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_price_history_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_history_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          default_currency: string
          default_payment_terms: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          default_currency?: string
          default_payment_terms?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          default_currency?: string
          default_payment_terms?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      voice_notes: {
        Row: {
          ai_summary: string | null
          audio_url: string | null
          created_at: string
          duration_seconds: number | null
          engineer_id: string
          id: string
          job_id: string | null
          transcript: string | null
        }
        Insert: {
          ai_summary?: string | null
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          engineer_id: string
          id?: string
          job_id?: string | null
          transcript?: string | null
        }
        Update: {
          ai_summary?: string | null
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          engineer_id?: string
          id?: string
          job_id?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          owner_id: string
          owner_type: Database["public"]["Enums"]["wallet_owner_type"]
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          owner_id: string
          owner_type: Database["public"]["Enums"]["wallet_owner_type"]
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          owner_id?: string
          owner_type?: Database["public"]["Enums"]["wallet_owner_type"]
          updated_at?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          subscription_id: string | null
          success: boolean
        }
        Insert: {
          attempt?: number
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          subscription_id?: string | null
          success?: boolean
        }
        Update: {
          attempt?: number
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          subscription_id?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "webhook_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_subscriptions: {
        Row: {
          created_at: string
          created_by: string | null
          events: string[]
          failure_count: number
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      jobs_engineer_safe: {
        Row: {
          assigned_by: string | null
          auto_reassign_enabled: boolean | null
          client_id: string | null
          completed_at: string | null
          convenience_allowance: number | null
          created_at: string | null
          delayed_at: string | null
          delayed_reason: string | null
          description: string | null
          engineer_id: string | null
          engineer_net: number | null
          food_allowance: number | null
          geofence_radius: number | null
          id: string | null
          is_delayed: boolean | null
          last_reassigned_at: string | null
          latitude: number | null
          location: string | null
          longitude: number | null
          notes: string | null
          payout_approved_at: string | null
          payout_paid_amount: number | null
          payout_paid_at: string | null
          payout_status: Database["public"]["Enums"]["payout_status"] | null
          priority: Database["public"]["Enums"]["job_priority"] | null
          reassign_count: number | null
          reassign_grace_minutes: number | null
          region_id: string | null
          required_skills: string[] | null
          scheduled_at: string | null
          service_type: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          title: string | null
          transport_allowance: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          auto_reassign_enabled?: boolean | null
          client_id?: string | null
          completed_at?: string | null
          convenience_allowance?: number | null
          created_at?: string | null
          delayed_at?: string | null
          delayed_reason?: string | null
          description?: string | null
          engineer_id?: string | null
          engineer_net?: number | null
          food_allowance?: number | null
          geofence_radius?: number | null
          id?: string | null
          is_delayed?: boolean | null
          last_reassigned_at?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          notes?: string | null
          payout_approved_at?: string | null
          payout_paid_amount?: number | null
          payout_paid_at?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"] | null
          priority?: Database["public"]["Enums"]["job_priority"] | null
          reassign_count?: number | null
          reassign_grace_minutes?: number | null
          region_id?: string | null
          required_skills?: string[] | null
          scheduled_at?: string | null
          service_type?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title?: string | null
          transport_allowance?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          auto_reassign_enabled?: boolean | null
          client_id?: string | null
          completed_at?: string | null
          convenience_allowance?: number | null
          created_at?: string | null
          delayed_at?: string | null
          delayed_reason?: string | null
          description?: string | null
          engineer_id?: string | null
          engineer_net?: number | null
          food_allowance?: number | null
          geofence_radius?: number | null
          id?: string | null
          is_delayed?: boolean | null
          last_reassigned_at?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          notes?: string | null
          payout_approved_at?: string | null
          payout_paid_amount?: number | null
          payout_paid_at?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"] | null
          priority?: Database["public"]["Enums"]["job_priority"] | null
          reassign_count?: number | null
          reassign_grace_minutes?: number | null
          region_id?: string | null
          required_skills?: string[] | null
          scheduled_at?: string | null
          service_type?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title?: string | null
          transport_allowance?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings_engineer_safe: {
        Row: {
          convenience_allowance: number | null
          created_at: string | null
          engineer_net: number | null
          expires_at: string | null
          food_allowance: number | null
          id: string | null
          job_id: string | null
          pay_negotiable: boolean | null
          payout_status: Database["public"]["Enums"]["payout_status"] | null
          posted_by: string | null
          posted_pay: number | null
          required_certifications: string[] | null
          required_skills: string[] | null
          status: string | null
          transport_allowance: number | null
          updated_at: string | null
          view_count: number | null
          visibility: string | null
        }
        Insert: {
          convenience_allowance?: number | null
          created_at?: string | null
          engineer_net?: number | null
          expires_at?: string | null
          food_allowance?: number | null
          id?: string | null
          job_id?: string | null
          pay_negotiable?: boolean | null
          payout_status?: Database["public"]["Enums"]["payout_status"] | null
          posted_by?: string | null
          posted_pay?: number | null
          required_certifications?: string[] | null
          required_skills?: string[] | null
          status?: string | null
          transport_allowance?: number | null
          updated_at?: string | null
          view_count?: number | null
          visibility?: string | null
        }
        Update: {
          convenience_allowance?: number | null
          created_at?: string | null
          engineer_net?: number | null
          expires_at?: string | null
          food_allowance?: number | null
          id?: string | null
          job_id?: string | null
          pay_negotiable?: boolean | null
          payout_status?: Database["public"]["Enums"]["payout_status"] | null
          posted_by?: string | null
          posted_pay?: number | null
          required_certifications?: string[] | null
          required_skills?: string[] | null
          status?: string | null
          transport_allowance?: number | null
          updated_at?: string | null
          view_count?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs_engineer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _payout_changed: {
        Args: { new_val: number; old_val: number }
        Returns: boolean
      }
      accept_marketplace_application: {
        Args: { _application_id: string }
        Returns: undefined
      }
      acknowledge_po_by_token: { Args: { _token: string }; Returns: boolean }
      auto_reassign_scan: { Args: never; Returns: Json }
      can_client_view_engineer: {
        Args: { _engineer_id: string; _user_id: string }
        Returns: boolean
      }
      can_engineer_view_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      can_partner_access_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      client_portal_role_of: {
        Args: { _client_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["client_portal_role"]
      }
      convert_estimate_to_invoice: {
        Args: {
          _due_date?: string
          _estimate_id: string
          _keep_linked?: boolean
        }
        Returns: string
      }
      current_engineer_id: { Args: never; Returns: string }
      escalate_stuck_tickets: {
        Args: never
        Returns: {
          new_level: number
          reason: string
          ticket_id: string
        }[]
      }
      evaluate_smart_match_for_job: {
        Args: { _job_id: string }
        Returns: undefined
      }
      find_best_engineer_for_job: {
        Args: { _job_id: string }
        Returns: {
          distance_km: number
          engineer_id: string
          score: number
        }[]
      }
      get_ai_config: {
        Args: never
        Returns: {
          base_url: string
          has_api_key: boolean
          model: string
          provider: string
          updated_at: string
          vision_model: string
        }[]
      }
      get_po_by_share_token: {
        Args: { _token: string }
        Returns: {
          created_at: string
          currency: string
          expected_delivery: string
          id: string
          items: Json
          notes: string
          po_number: string
          shipping_cost: number
          status: string
          subtotal: number
          tax_amount: number
          total: number
          vendor_acknowledged_at: string
          vendor_email: string
          vendor_name: string
        }[]
      }
      get_ticket_unread_counts: {
        Args: never
        Returns: {
          ticket_id: string
          unread_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_meters: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      is_chat_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      is_client_member: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      normalize_unit: { Args: { raw: string }; Returns: string }
      po_three_way_match: { Args: { _po_id: string }; Returns: string }
      reassign_delayed_job: {
        Args: { _job_id: string; _kind?: string; _reason?: string }
        Returns: Json
      }
      recompute_engineer_success_score: {
        Args: { _engineer_id: string }
        Returns: undefined
      }
      reject_marketplace_application: {
        Args: { _application_id: string; _note?: string }
        Returns: undefined
      }
      resolve_chat_sync_failure: {
        Args: { p_failure_id: string; p_status: string }
        Returns: undefined
      }
      resolve_service_desk_team: {
        Args: {
          _city: string
          _country: string
          _region: string
          _service_category: string
        }
        Returns: string
      }
      retry_chat_sync: { Args: { p_failure_id: string }; Returns: Json }
      set_ai_config: {
        Args: {
          p_api_key?: string
          p_base_url: string
          p_model: string
          p_provider: string
          p_vision_model: string
        }
        Returns: undefined
      }
      set_bank_details_verified: {
        Args: { _bank_details_id: string; _verified: boolean }
        Returns: undefined
      }
      sow_version_transition: {
        Args: {
          _contract_id: string
          _note?: string
          _to_status: string
          _version: number
        }
        Returns: undefined
      }
      submit_engineer_application: {
        Args: {
          p_assigned_admin_email?: string
          p_assigned_admin_id?: string
          p_certification?: string
          p_certifications?: string[]
          p_city: string
          p_country: string
          p_email: string
          p_full_name: string
          p_id_document_back_data?: string
          p_id_document_back_name?: string
          p_id_document_front_data?: string
          p_id_document_front_name?: string
          p_id_type?: string
          p_nda_signed?: boolean
          p_nda_signed_at?: string
          p_phone: string
          p_postcode: string
          p_residential_address: string
          p_skills: string[]
          p_specialty: string
          p_state: string
          p_user_id: string
        }
        Returns: undefined
      }
      sync_chat_message_to_ticket_log: {
        Args: { p_new_id: string; p_old_id: string; p_op: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "team_lead"
        | "partner"
        | "client"
        | "engineer"
        | "associate_coordinator"
        | "service_desk"
        | "recruiter"
      client_portal_role: "owner" | "approver" | "viewer"
      estimate_status:
        | "draft"
        | "sent"
        | "approved"
        | "rejected"
        | "expired"
        | "pending_approval"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      job_priority: "low" | "medium" | "high" | "urgent"
      job_status:
        | "pending"
        | "assigned"
        | "accepted"
        | "on_the_way"
        | "in_progress"
        | "completed"
        | "cancelled"
      nomination_status: "pending" | "approved" | "rejected"
      payout_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "released"
        | "estimated"
      receipt_kind: "invoice_payment" | "standalone"
      tax_mode: "single" | "dual_split" | "compound" | "per_line"
      ticket_category: "complaint" | "support" | "billing" | "general"
      ticket_status:
        | "new"
        | "open"
        | "assigned"
        | "in_progress"
        | "resolved"
        | "closed"
      wallet_owner_type: "client" | "engineer"
      wallet_transaction_type:
        | "deposit"
        | "withdrawal"
        | "payment"
        | "payout"
        | "refund"
        | "adjustment"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "admin",
        "team_lead",
        "partner",
        "client",
        "engineer",
        "associate_coordinator",
        "service_desk",
        "recruiter",
      ],
      client_portal_role: ["owner", "approver", "viewer"],
      estimate_status: [
        "draft",
        "sent",
        "approved",
        "rejected",
        "expired",
        "pending_approval",
      ],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      job_priority: ["low", "medium", "high", "urgent"],
      job_status: [
        "pending",
        "assigned",
        "accepted",
        "on_the_way",
        "in_progress",
        "completed",
        "cancelled",
      ],
      nomination_status: ["pending", "approved", "rejected"],
      payout_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "released",
        "estimated",
      ],
      receipt_kind: ["invoice_payment", "standalone"],
      tax_mode: ["single", "dual_split", "compound", "per_line"],
      ticket_category: ["complaint", "support", "billing", "general"],
      ticket_status: [
        "new",
        "open",
        "assigned",
        "in_progress",
        "resolved",
        "closed",
      ],
      wallet_owner_type: ["client", "engineer"],
      wallet_transaction_type: [
        "deposit",
        "withdrawal",
        "payment",
        "payout",
        "refund",
        "adjustment",
      ],
    },
  },
} as const
