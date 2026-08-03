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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      advantages: {
        Row: {
          campaign_id: string
          character_id: string
          cmod_delta: number
          consumed_at: string | null
          consumed_roll_log_id: string | null
          created_at: string
          description: string
          granted_by: string | null
          id: string
          skill_name: string
          source_roll_log_id: string | null
        }
        Insert: {
          campaign_id: string
          character_id: string
          cmod_delta?: number
          consumed_at?: string | null
          consumed_roll_log_id?: string | null
          created_at?: string
          description: string
          granted_by?: string | null
          id?: string
          skill_name: string
          source_roll_log_id?: string | null
        }
        Update: {
          campaign_id?: string
          character_id?: string
          cmod_delta?: number
          consumed_at?: string | null
          consumed_roll_log_id?: string | null
          created_at?: string
          description?: string
          granted_by?: string | null
          id?: string
          skill_name?: string
          source_roll_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advantages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advantages_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advantages_consumed_roll_log_id_fkey"
            columns: ["consumed_roll_log_id"]
            isOneToOne: false
            referencedRelation: "roll_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advantages_source_roll_log_id_fkey"
            columns: ["source_roll_log_id"]
            isOneToOne: false
            referencedRelation: "roll_log"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          actor_role: string | null
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          campaign_id: string | null
          client_ip: string | null
          id: number
          occurred_at: string
          operation: string
          reason: string | null
          recovered_at: string | null
          recovery_attempted: boolean
          row_id: string
          table_name: string
          user_agent: string | null
        }
        Insert: {
          actor_role?: string | null
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          campaign_id?: string | null
          client_ip?: string | null
          id?: number
          occurred_at?: string
          operation: string
          reason?: string | null
          recovered_at?: string | null
          recovery_attempted?: boolean
          row_id: string
          table_name: string
          user_agent?: string | null
        }
        Update: {
          actor_role?: string | null
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          campaign_id?: string | null
          client_ip?: string | null
          id?: number
          occurred_at?: string
          operation?: string
          reason?: string | null
          recovered_at?: string | null
          recovery_attempted?: boolean
          row_id?: string
          table_name?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          page_url: string | null
          reporter_email: string | null
          reporter_id: string | null
          reporter_name: string | null
          responded_at: string | null
          responded_by: string | null
          response_text: string | null
          status: string
          thriver_notes: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          page_url?: string | null
          reporter_email?: string | null
          reporter_id?: string | null
          reporter_name?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response_text?: string | null
          status?: string
          thriver_notes?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          page_url?: string | null
          reporter_email?: string | null
          reporter_id?: string | null
          reporter_name?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response_text?: string | null
          status?: string
          thriver_notes?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      campaign_events: {
        Row: {
          applied_canon_day: number | null
          applied_canon_hour: number | null
          campaign_id: string
          cancelled_at: string | null
          cancelled_reason: string | null
          created_at: string
          created_by: string | null
          id: string
          payload: Json
          scheduled_canon_day: number
          scheduled_canon_hour: number
          target_character_id: string | null
          type: string
        }
        Insert: {
          applied_canon_day?: number | null
          applied_canon_hour?: number | null
          campaign_id: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          scheduled_canon_day: number
          scheduled_canon_hour?: number
          target_character_id?: string | null
          type: string
        }
        Update: {
          applied_canon_day?: number | null
          applied_canon_hour?: number | null
          campaign_id?: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          scheduled_canon_day?: number
          scheduled_canon_hour?: number
          target_character_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_target_character_id_fkey"
            columns: ["target_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_invitations: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          message: string | null
          recipient_user_id: string
          responded_at: string | null
          sender_user_id: string
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          message?: string | null
          recipient_user_id: string
          responded_at?: string | null
          sender_user_id: string
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          message?: string | null
          recipient_user_id?: string
          responded_at?: string | null
          sender_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_invitations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_members: {
        Row: {
          campaign_id: string
          character_id: string | null
          id: string
          joined_at: string | null
          observer: boolean
          user_id: string
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          id?: string
          joined_at?: string | null
          observer?: boolean
          user_id: string
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          id?: string
          joined_at?: string | null
          observer?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_notes: {
        Row: {
          attachments: Json
          campaign_id: string
          content: string
          created_at: string | null
          edited_since_clone: boolean
          id: string
          shared: boolean
          sort_order: number | null
          source_module_id: string | null
          source_module_version_id: string | null
          title: string
        }
        Insert: {
          attachments?: Json
          campaign_id: string
          content?: string
          created_at?: string | null
          edited_since_clone?: boolean
          id?: string
          shared?: boolean
          sort_order?: number | null
          source_module_id?: string | null
          source_module_version_id?: string | null
          title?: string
        }
        Update: {
          attachments?: Json
          campaign_id?: string
          content?: string
          created_at?: string | null
          edited_since_clone?: boolean
          id?: string
          shared?: boolean
          sort_order?: number | null
          source_module_id?: string | null
          source_module_version_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_notes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_notes_source_module_id_fkey"
            columns: ["source_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_notes_source_module_version_id_fkey"
            columns: ["source_module_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_npcs: {
        Row: {
          acumen: number
          campaign_id: string
          campaign_pin_id: string | null
          complication: string | null
          created_at: string
          death_countdown: number | null
          dexterity: number
          disposition: string | null
          edited_since_clone: boolean
          equipment: Json | null
          folder: string | null
          hidden_from_players: boolean
          id: string
          incap_rounds: number | null
          infection_days_left: number | null
          infection_infected_by: string | null
          infection_lasting_risk: boolean
          infection_pending_lasting_check: boolean
          infection_severity: string | null
          infection_started_at: string | null
          infection_state: string | null
          influence: number
          inventory: Json | null
          lasting_wounds: Json
          motivation: string | null
          name: string
          notes: string | null
          npc_type: string | null
          physicality: number
          portrait_url: string | null
          public_description: string | null
          reason: number
          recruit_locked_approaches: string[]
          recruitment_role: string | null
          rp_current: number | null
          rp_max: number | null
          skills: Json
          sort_order: number | null
          source_module_id: string | null
          source_module_version_id: string | null
          status: string
          three_words: string[] | null
          world_npc_id: string | null
          wp_current: number | null
          wp_max: number | null
        }
        Insert: {
          acumen?: number
          campaign_id: string
          campaign_pin_id?: string | null
          complication?: string | null
          created_at?: string
          death_countdown?: number | null
          dexterity?: number
          disposition?: string | null
          edited_since_clone?: boolean
          equipment?: Json | null
          folder?: string | null
          hidden_from_players?: boolean
          id?: string
          incap_rounds?: number | null
          infection_days_left?: number | null
          infection_infected_by?: string | null
          infection_lasting_risk?: boolean
          infection_pending_lasting_check?: boolean
          infection_severity?: string | null
          infection_started_at?: string | null
          infection_state?: string | null
          influence?: number
          inventory?: Json | null
          lasting_wounds?: Json
          motivation?: string | null
          name: string
          notes?: string | null
          npc_type?: string | null
          physicality?: number
          portrait_url?: string | null
          public_description?: string | null
          reason?: number
          recruit_locked_approaches?: string[]
          recruitment_role?: string | null
          rp_current?: number | null
          rp_max?: number | null
          skills?: Json
          sort_order?: number | null
          source_module_id?: string | null
          source_module_version_id?: string | null
          status?: string
          three_words?: string[] | null
          world_npc_id?: string | null
          wp_current?: number | null
          wp_max?: number | null
        }
        Update: {
          acumen?: number
          campaign_id?: string
          campaign_pin_id?: string | null
          complication?: string | null
          created_at?: string
          death_countdown?: number | null
          dexterity?: number
          disposition?: string | null
          edited_since_clone?: boolean
          equipment?: Json | null
          folder?: string | null
          hidden_from_players?: boolean
          id?: string
          incap_rounds?: number | null
          infection_days_left?: number | null
          infection_infected_by?: string | null
          infection_lasting_risk?: boolean
          infection_pending_lasting_check?: boolean
          infection_severity?: string | null
          infection_started_at?: string | null
          infection_state?: string | null
          influence?: number
          inventory?: Json | null
          lasting_wounds?: Json
          motivation?: string | null
          name?: string
          notes?: string | null
          npc_type?: string | null
          physicality?: number
          portrait_url?: string | null
          public_description?: string | null
          reason?: number
          recruit_locked_approaches?: string[]
          recruitment_role?: string | null
          rp_current?: number | null
          rp_max?: number | null
          skills?: Json
          sort_order?: number | null
          source_module_id?: string | null
          source_module_version_id?: string | null
          status?: string
          three_words?: string[] | null
          world_npc_id?: string | null
          wp_current?: number | null
          wp_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_npcs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_npcs_campaign_pin_id_fkey"
            columns: ["campaign_pin_id"]
            isOneToOne: false
            referencedRelation: "campaign_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_npcs_source_module_id_fkey"
            columns: ["source_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_npcs_source_module_version_id_fkey"
            columns: ["source_module_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_pins: {
        Row: {
          campaign_id: string
          category: string | null
          created_at: string
          edited_since_clone: boolean
          folder: string | null
          id: string
          lat: number
          lng: number
          name: string
          notes: string | null
          reader_mode: string | null
          revealed: boolean
          sort_order: number | null
          source_module_id: string | null
          source_module_version_id: string | null
          tactical_scene_id: string | null
        }
        Insert: {
          campaign_id: string
          category?: string | null
          created_at?: string
          edited_since_clone?: boolean
          folder?: string | null
          id?: string
          lat: number
          lng: number
          name: string
          notes?: string | null
          reader_mode?: string | null
          revealed?: boolean
          sort_order?: number | null
          source_module_id?: string | null
          source_module_version_id?: string | null
          tactical_scene_id?: string | null
        }
        Update: {
          campaign_id?: string
          category?: string | null
          created_at?: string
          edited_since_clone?: boolean
          folder?: string | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          notes?: string | null
          reader_mode?: string | null
          revealed?: boolean
          sort_order?: number | null
          source_module_id?: string | null
          source_module_version_id?: string | null
          tactical_scene_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_pins_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_pins_source_module_id_fkey"
            columns: ["source_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_pins_source_module_version_id_fkey"
            columns: ["source_module_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_pins_tactical_scene_id_fkey"
            columns: ["tactical_scene_id"]
            isOneToOne: false
            referencedRelation: "tactical_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_portrait_usage: {
        Row: {
          campaign_id: string
          gender: string
          id: string
          portrait_url: string
          used_at: string
        }
        Insert: {
          campaign_id: string
          gender: string
          id?: string
          portrait_url: string
          used_at?: string
        }
        Update: {
          campaign_id?: string
          gender?: string
          id?: string
          portrait_url?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_portrait_usage_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_snapshots: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          includes_character_states: boolean
          name: string
          snapshot: Json
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          includes_character_states?: boolean
          name: string
          snapshot: Json
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          includes_character_states?: boolean
          name?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campaign_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          clock: Json
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          gm_user_id: string
          id: string
          invite_code: string
          last_accessed_at: string | null
          map_center_lat: number | null
          map_center_lng: number | null
          map_style: string | null
          name: string
          session_count: number
          session_started_at: string | null
          session_status: string
          setting: string
          start_canon_day: number | null
          status: string
          vehicles: Json | null
        }
        Insert: {
          clock?: Json
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          gm_user_id: string
          id?: string
          invite_code: string
          last_accessed_at?: string | null
          map_center_lat?: number | null
          map_center_lng?: number | null
          map_style?: string | null
          name: string
          session_count?: number
          session_started_at?: string | null
          session_status?: string
          setting?: string
          start_canon_day?: number | null
          status?: string
          vehicles?: Json | null
        }
        Update: {
          clock?: Json
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          gm_user_id?: string
          id?: string
          invite_code?: string
          last_accessed_at?: string | null
          map_center_lat?: number | null
          map_center_lng?: number | null
          map_style?: string | null
          name?: string
          session_count?: number
          session_started_at?: string | null
          session_status?: string
          setting?: string
          start_canon_day?: number | null
          status?: string
          vehicles?: Json | null
        }
        Relationships: []
      }
      character_states: {
        Row: {
          campaign_id: string
          cdp: number
          character_id: string
          death_countdown: number | null
          id: string
          incap_rounds: number | null
          infection_days_left: number | null
          infection_infected_by: string | null
          infection_lasting_risk: boolean
          infection_pending_lasting_check: boolean
          infection_severity: string | null
          infection_started_at: string | null
          infection_state: string | null
          insight_dice: number
          kicked: boolean
          morality: number
          recovering_from_mortal_wound: boolean
          rp_current: number
          rp_max: number
          stress: number
          updated_at: string | null
          user_id: string
          wp_current: number
          wp_max: number
        }
        Insert: {
          campaign_id: string
          cdp?: number
          character_id: string
          death_countdown?: number | null
          id?: string
          incap_rounds?: number | null
          infection_days_left?: number | null
          infection_infected_by?: string | null
          infection_lasting_risk?: boolean
          infection_pending_lasting_check?: boolean
          infection_severity?: string | null
          infection_started_at?: string | null
          infection_state?: string | null
          insight_dice?: number
          kicked?: boolean
          morality?: number
          recovering_from_mortal_wound?: boolean
          rp_current?: number
          rp_max?: number
          stress?: number
          updated_at?: string | null
          user_id: string
          wp_current?: number
          wp_max?: number
        }
        Update: {
          campaign_id?: string
          cdp?: number
          character_id?: string
          death_countdown?: number | null
          id?: string
          incap_rounds?: number | null
          infection_days_left?: number | null
          infection_infected_by?: string | null
          infection_lasting_risk?: boolean
          infection_pending_lasting_check?: boolean
          infection_severity?: string | null
          infection_started_at?: string | null
          infection_state?: string | null
          insight_dice?: number
          kicked?: boolean
          morality?: number
          recovering_from_mortal_wound?: boolean
          rp_current?: number
          rp_max?: number
          stress?: number
          updated_at?: string | null
          user_id?: string
          wp_current?: number
          wp_max?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_states_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_states_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          name: string
          portrait_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          id?: string
          name: string
          portrait_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          name?: string
          portrait_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          campaign_id: string
          character_name: string
          created_at: string
          id: string
          is_whisper: boolean
          message: string
          recipient_user_id: string | null
          user_id: string
        }
        Insert: {
          campaign_id: string
          character_name: string
          created_at?: string
          id?: string
          is_whisper?: boolean
          message: string
          recipient_user_id?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string
          character_name?: string
          created_at?: string
          id?: string
          is_whisper?: boolean
          message?: string
          recipient_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          campaign_id: string
          consecutive_failures: number
          created_at: string
          description: string | null
          dissolved_at: string | null
          homestead_pin_id: string | null
          id: string
          leader_npc_id: string | null
          leader_user_id: string | null
          name: string | null
          notified_community_milestone: boolean
          published_at: string | null
          stage: string
          status: string
          week_number: number
          world_community_id: string | null
          world_visibility: string
        }
        Insert: {
          campaign_id: string
          consecutive_failures?: number
          created_at?: string
          description?: string | null
          dissolved_at?: string | null
          homestead_pin_id?: string | null
          id?: string
          leader_npc_id?: string | null
          leader_user_id?: string | null
          name?: string | null
          notified_community_milestone?: boolean
          published_at?: string | null
          stage?: string
          status?: string
          week_number?: number
          world_community_id?: string | null
          world_visibility?: string
        }
        Update: {
          campaign_id?: string
          consecutive_failures?: number
          created_at?: string
          description?: string | null
          dissolved_at?: string | null
          homestead_pin_id?: string | null
          id?: string
          leader_npc_id?: string | null
          leader_user_id?: string | null
          name?: string | null
          notified_community_milestone?: boolean
          published_at?: string | null
          stage?: string
          status?: string
          week_number?: number
          world_community_id?: string | null
          world_visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "communities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_homestead_pin_id_fkey"
            columns: ["homestead_pin_id"]
            isOneToOne: false
            referencedRelation: "campaign_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_leader_npc_id_fkey"
            columns: ["leader_npc_id"]
            isOneToOne: false
            referencedRelation: "campaign_npcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_world_community_fk"
            columns: ["world_community_id"]
            isOneToOne: false
            referencedRelation: "world_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_encounters: {
        Row: {
          created_at: string
          encountering_campaign_id: string
          encountering_user_id: string | null
          id: string
          narrative: string | null
          responded_at: string | null
          status: string
          world_community_id: string
        }
        Insert: {
          created_at?: string
          encountering_campaign_id: string
          encountering_user_id?: string | null
          id?: string
          narrative?: string | null
          responded_at?: string | null
          status?: string
          world_community_id: string
        }
        Update: {
          created_at?: string
          encountering_campaign_id?: string
          encountering_user_id?: string | null
          id?: string
          narrative?: string | null
          responded_at?: string | null
          status?: string
          world_community_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_encounters_encountering_campaign_id_fkey"
            columns: ["encountering_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_encounters_world_community_id_fkey"
            columns: ["world_community_id"]
            isOneToOne: false
            referencedRelation: "world_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_events: {
        Row: {
          author_user_id: string | null
          community_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          author_user_id?: string | null
          community_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          author_user_id?: string | null
          community_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "community_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          apprentice_meta: Json | null
          apprentice_of_character_id: string | null
          assignment_pc_id: string | null
          campaign_id: string | null
          character_id: string | null
          community_id: string
          current_task: string | null
          escape_pending: boolean
          id: string
          invited_by_user_id: string | null
          joined_at: string
          left_at: string | null
          left_reason: string | null
          npc_id: string | null
          recruitment_type: string
          role: string
          status: string
          temporary_until_morale: boolean
        }
        Insert: {
          apprentice_meta?: Json | null
          apprentice_of_character_id?: string | null
          assignment_pc_id?: string | null
          campaign_id?: string | null
          character_id?: string | null
          community_id: string
          current_task?: string | null
          escape_pending?: boolean
          id?: string
          invited_by_user_id?: string | null
          joined_at?: string
          left_at?: string | null
          left_reason?: string | null
          npc_id?: string | null
          recruitment_type?: string
          role?: string
          status?: string
          temporary_until_morale?: boolean
        }
        Update: {
          apprentice_meta?: Json | null
          apprentice_of_character_id?: string | null
          assignment_pc_id?: string | null
          campaign_id?: string | null
          character_id?: string | null
          community_id?: string
          current_task?: string | null
          escape_pending?: boolean
          id?: string
          invited_by_user_id?: string | null
          joined_at?: string
          left_at?: string | null
          left_reason?: string | null
          npc_id?: string | null
          recruitment_type?: string
          role?: string
          status?: string
          temporary_until_morale?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "community_members_apprentice_of_character_id_fkey"
            columns: ["apprentice_of_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_assignment_pc_id_fkey"
            columns: ["assignment_pc_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "campaign_npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      community_migrations: {
        Row: {
          created_at: string
          id: string
          narrative: string | null
          npc_name: string
          offered_by_user_id: string | null
          responded_at: string | null
          source_community_id: string
          source_community_name: string
          source_member_id: string | null
          source_npc_id: string | null
          status: string
          target_world_community_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          narrative?: string | null
          npc_name: string
          offered_by_user_id?: string | null
          responded_at?: string | null
          source_community_id: string
          source_community_name: string
          source_member_id?: string | null
          source_npc_id?: string | null
          status?: string
          target_world_community_id: string
        }
        Update: {
          created_at?: string
          id?: string
          narrative?: string | null
          npc_name?: string
          offered_by_user_id?: string | null
          responded_at?: string | null
          source_community_id?: string
          source_community_name?: string
          source_member_id?: string | null
          source_npc_id?: string | null
          status?: string
          target_world_community_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_migrations_source_community_id_fkey"
            columns: ["source_community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_migrations_source_member_id_fkey"
            columns: ["source_member_id"]
            isOneToOne: false
            referencedRelation: "community_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_migrations_source_npc_id_fkey"
            columns: ["source_npc_id"]
            isOneToOne: false
            referencedRelation: "campaign_npcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_migrations_target_world_community_id_fkey"
            columns: ["target_world_community_id"]
            isOneToOne: false
            referencedRelation: "world_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_morale_checks: {
        Row: {
          amod: number
          cmod_for_next: number
          cmod_total: number
          community_id: string
          die1: number
          die2: number
          id: string
          members_after: number
          members_before: number
          modifiers_json: Json
          outcome: string
          role_snapshot: Json | null
          rolled_at: string
          rolled_by_user_id: string | null
          smod: number
          total: number
          week_number: number
        }
        Insert: {
          amod?: number
          cmod_for_next?: number
          cmod_total?: number
          community_id: string
          die1: number
          die2: number
          id?: string
          members_after: number
          members_before: number
          modifiers_json?: Json
          outcome: string
          role_snapshot?: Json | null
          rolled_at?: string
          rolled_by_user_id?: string | null
          smod?: number
          total: number
          week_number: number
        }
        Update: {
          amod?: number
          cmod_for_next?: number
          cmod_total?: number
          community_id?: string
          die1?: number
          die2?: number
          id?: string
          members_after?: number
          members_before?: number
          modifiers_json?: Json
          outcome?: string
          role_snapshot?: Json | null
          rolled_at?: string
          rolled_by_user_id?: string | null
          smod?: number
          total?: number
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_morale_checks_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_resource_checks: {
        Row: {
          amod: number
          cmod_for_next_morale: number
          cmod_total: number
          community_id: string
          die1: number
          die2: number
          id: string
          kind: string
          outcome: string
          rolled_at: string
          rolled_by_user_id: string | null
          smod: number
          total: number
          week_number: number
        }
        Insert: {
          amod?: number
          cmod_for_next_morale?: number
          cmod_total?: number
          community_id: string
          die1: number
          die2: number
          id?: string
          kind: string
          outcome: string
          rolled_at?: string
          rolled_by_user_id?: string | null
          smod?: number
          total: number
          week_number: number
        }
        Update: {
          amod?: number
          cmod_for_next_morale?: number
          cmod_total?: number
          community_id?: string
          die1?: number
          die2?: number
          id?: string
          kind?: string
          outcome?: string
          rolled_at?: string
          rolled_by_user_id?: string | null
          smod?: number
          total?: number
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_resource_checks_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_stockpile_items: {
        Row: {
          community_id: string
          created_at: string
          custom: boolean
          enc: number
          id: string
          name: string
          notes: string
          qty: number
          rarity: string
        }
        Insert: {
          community_id: string
          created_at?: string
          custom?: boolean
          enc?: number
          id?: string
          name: string
          notes?: string
          qty?: number
          rarity?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          custom?: boolean
          enc?: number
          id?: string
          name?: string
          notes?: string
          qty?: number
          rarity?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_stockpile_items_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_subscriptions: {
        Row: {
          created_at: string
          id: string
          user_id: string
          world_community_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          world_community_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          world_community_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_subscriptions_world_community_id_fkey"
            columns: ["world_community_id"]
            isOneToOne: false
            referencedRelation: "world_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          archived_at: string | null
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id?: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      debug_log: {
        Row: {
          campaign_id: string | null
          client_id: string | null
          created_at: string
          event: string
          id: string
          level: string
          payload: Json | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          event: string
          id?: string
          level: string
          payload?: Json | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          event?: string
          id?: string
          level?: string
          payload?: Json | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debug_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_checklist_state: {
        Row: {
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_thread_reactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_thread_reactions_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          author_user_id: string | null
          body: string
          campaign_id: string | null
          category: string
          created_at: string
          id: string
          latest_reply_at: string
          locked: boolean
          moderation_status: string
          moderator_notes: string | null
          pinned: boolean
          reply_count: number
          search_tsv: unknown
          setting: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          author_user_id?: string | null
          body: string
          campaign_id?: string | null
          category: string
          created_at?: string
          id?: string
          latest_reply_at?: string
          locked?: boolean
          moderation_status?: string
          moderator_notes?: string | null
          pinned?: boolean
          reply_count?: number
          search_tsv?: unknown
          setting?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          author_user_id?: string | null
          body?: string
          campaign_id?: string | null
          category?: string
          created_at?: string
          id?: string
          latest_reply_at?: string
          locked?: boolean
          moderation_status?: string
          moderator_notes?: string | null
          pinned?: boolean
          reply_count?: number
          search_tsv?: unknown
          setting?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_threads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      gm_scratch: {
        Row: {
          campaign_id: string
          text: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          text?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gm_scratch_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      gm_screen_layouts: {
        Row: {
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gm_screen_standard_layout: {
        Row: {
          id: number
          state: Json
          updated_at: string
        }
        Insert: {
          id?: number
          state?: Json
          updated_at?: string
        }
        Update: {
          id?: number
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      initiative_order: {
        Row: {
          actions_remaining: number | null
          aim_active: boolean
          aim_bonus: number | null
          campaign_id: string | null
          character_id: string | null
          character_name: string
          coordinate_bonus: number
          coordinate_target: string | null
          created_at: string | null
          defense_bonus: number
          grappled_by: string | null
          has_cover: boolean
          hidden_from_players: boolean
          id: string
          incoming_cmod: number
          inspired_this_round: boolean
          is_active: boolean | null
          is_npc: boolean | null
          last_attack_target: string | null
          npc_id: string | null
          npc_type: string | null
          pending_action_loss: boolean
          portrait_url: string | null
          roll: number
          turn_number: number | null
          user_id: string | null
          winded: boolean
        }
        Insert: {
          actions_remaining?: number | null
          aim_active?: boolean
          aim_bonus?: number | null
          campaign_id?: string | null
          character_id?: string | null
          character_name: string
          coordinate_bonus?: number
          coordinate_target?: string | null
          created_at?: string | null
          defense_bonus?: number
          grappled_by?: string | null
          has_cover?: boolean
          hidden_from_players?: boolean
          id?: string
          incoming_cmod?: number
          inspired_this_round?: boolean
          is_active?: boolean | null
          is_npc?: boolean | null
          last_attack_target?: string | null
          npc_id?: string | null
          npc_type?: string | null
          pending_action_loss?: boolean
          portrait_url?: string | null
          roll: number
          turn_number?: number | null
          user_id?: string | null
          winded?: boolean
        }
        Update: {
          actions_remaining?: number | null
          aim_active?: boolean
          aim_bonus?: number | null
          campaign_id?: string | null
          character_id?: string | null
          character_name?: string
          coordinate_bonus?: number
          coordinate_target?: string | null
          created_at?: string | null
          defense_bonus?: number
          grappled_by?: string | null
          has_cover?: boolean
          hidden_from_players?: boolean
          id?: string
          incoming_cmod?: number
          inspired_this_round?: boolean
          is_active?: boolean | null
          is_npc?: boolean | null
          last_attack_target?: string | null
          npc_id?: string | null
          npc_type?: string | null
          pending_action_loss?: boolean
          portrait_url?: string | null
          roll?: number
          turn_number?: number | null
          user_id?: string | null
          winded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "initiative_order_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_reports: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          page_url: string | null
          source: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          page_url?: string | null
          source?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          page_url?: string | null
          source?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      launch_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          site: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          site?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          site?: string | null
          source?: string | null
        }
        Relationships: []
      }
      lfg_interests: {
        Row: {
          created_at: string
          id: string
          interested_user_id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interested_user_id: string
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interested_user_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lfg_interests_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "lfg_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      lfg_post_reactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lfg_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "lfg_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      lfg_post_replies: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lfg_post_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "lfg_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      lfg_posts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          kind: string
          latest_reply_at: string | null
          moderation_status: string
          moderator_notes: string | null
          reply_count: number
          schedule: string | null
          search_tsv: unknown
          setting: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          kind: string
          latest_reply_at?: string | null
          moderation_status?: string
          moderator_notes?: string | null
          reply_count?: number
          schedule?: string | null
          search_tsv?: unknown
          setting?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          kind?: string
          latest_reply_at?: string | null
          moderation_status?: string
          moderator_notes?: string | null
          reply_count?: number
          schedule?: string | null
          search_tsv?: unknown
          setting?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      map_pins: {
        Row: {
          address: string | null
          categories: Json
          category: string
          cmod_active: boolean
          cmod_impact: number | null
          cmod_label: string | null
          cmod_radius_km: number | null
          created_at: string | null
          event_date: string | null
          id: string
          lat: number
          lng: number
          notes: string | null
          parent_pin_id: string | null
          pin_type: string
          sort_order: number | null
          status: string
          title: string
          user_id: string
          view_count: number | null
        }
        Insert: {
          address?: string | null
          categories?: Json
          category?: string
          cmod_active?: boolean
          cmod_impact?: number | null
          cmod_label?: string | null
          cmod_radius_km?: number | null
          created_at?: string | null
          event_date?: string | null
          id?: string
          lat: number
          lng: number
          notes?: string | null
          parent_pin_id?: string | null
          pin_type?: string
          sort_order?: number | null
          status?: string
          title: string
          user_id: string
          view_count?: number | null
        }
        Update: {
          address?: string | null
          categories?: Json
          category?: string
          cmod_active?: boolean
          cmod_impact?: number | null
          cmod_label?: string | null
          cmod_radius_km?: number | null
          created_at?: string | null
          event_date?: string | null
          id?: string
          lat?: number
          lng?: number
          notes?: string | null
          parent_pin_id?: string | null
          pin_type?: string
          sort_order?: number | null
          status?: string
          title?: string
          user_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "map_pins_parent_pin_id_fkey"
            columns: ["parent_pin_id"]
            isOneToOne: false
            referencedRelation: "map_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_pins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_user_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_user_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      module_reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          module_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          module_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          module_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_reviews_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_subscriptions: {
        Row: {
          campaign_id: string
          current_version_id: string | null
          id: string
          module_id: string
          status: string
          subscribed_at: string
        }
        Insert: {
          campaign_id: string
          current_version_id?: string | null
          id?: string
          module_id: string
          status?: string
          subscribed_at?: string
        }
        Update: {
          campaign_id?: string
          current_version_id?: string | null
          id?: string
          module_id?: string
          status?: string
          subscribed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_subscriptions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_subscriptions_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_subscriptions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_versions: {
        Row: {
          changelog: string | null
          created_at: string
          id: string
          module_id: string
          platform_locked_at: string | null
          published_at: string
          published_by: string | null
          snapshot: Json
          start_canon_day: number | null
          subscriber_count: number
          version: string
          version_major: number
          version_minor: number
          version_patch: number
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          id?: string
          module_id: string
          platform_locked_at?: string | null
          published_at?: string
          published_by?: string | null
          snapshot: Json
          start_canon_day?: number | null
          subscriber_count?: number
          version: string
          version_major?: number
          version_minor?: number
          version_patch?: number
        }
        Update: {
          changelog?: string | null
          created_at?: string
          id?: string
          module_id?: string
          platform_locked_at?: string | null
          published_at?: string
          published_by?: string | null
          snapshot?: Json
          start_canon_day?: number | null
          subscriber_count?: number
          version?: string
          version_major?: number
          version_minor?: number
          version_patch?: number
        }
        Relationships: [
          {
            foreignKeyName: "module_versions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          archived_by: string | null
          author_user_id: string | null
          avg_rating: number | null
          content_tags: string[] | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          latest_version_id: string | null
          moderation_status: string
          name: string
          parent_setting: string | null
          play_time: string | null
          player_count_recommended: number | null
          rating_count: number | null
          session_count_estimate: number | null
          sort_order: number | null
          source_campaign_id: string | null
          start_canon_day: number | null
          subscriber_count: number
          tagline: string | null
          visibility: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          archived_by?: string | null
          author_user_id?: string | null
          avg_rating?: number | null
          content_tags?: string[] | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          latest_version_id?: string | null
          moderation_status?: string
          name: string
          parent_setting?: string | null
          play_time?: string | null
          player_count_recommended?: number | null
          rating_count?: number | null
          session_count_estimate?: number | null
          sort_order?: number | null
          source_campaign_id?: string | null
          start_canon_day?: number | null
          subscriber_count?: number
          tagline?: string | null
          visibility?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          archived_by?: string | null
          author_user_id?: string | null
          avg_rating?: number | null
          content_tags?: string[] | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          latest_version_id?: string | null
          moderation_status?: string
          name?: string
          parent_setting?: string | null
          play_time?: string | null
          player_count_recommended?: number | null
          rating_count?: number | null
          session_count_estimate?: number | null
          sort_order?: number | null
          source_campaign_id?: string | null
          start_canon_day?: number | null
          subscriber_count?: number
          tagline?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      npc_relationships: {
        Row: {
          campaign_id: string | null
          character_id: string
          created_at: string
          id: string
          notes: string | null
          npc_id: string
          relationship_cmod: number
          reveal_level: string | null
          revealed: boolean
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          character_id: string
          created_at?: string
          id?: string
          notes?: string | null
          npc_id: string
          relationship_cmod?: number
          reveal_level?: string | null
          revealed?: boolean
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          character_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          npc_id?: string
          relationship_cmod?: number
          reveal_level?: string | null
          revealed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "npc_relationships_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npc_relationships_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npc_relationships_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "campaign_npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      object_token_library: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          image_url: string
          metadata: Json | null
          name: string
          uploaded_by: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          image_url: string
          metadata?: Json | null
          name: string
          uploaded_by?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          image_url?: string
          metadata?: Json | null
          name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "object_token_library_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      player_notes: {
        Row: {
          campaign_id: string
          content: string
          created_at: string
          id: string
          session_number: number | null
          submitted_at: string | null
          submitted_to_summary: boolean
          title: string | null
          user_id: string
        }
        Insert: {
          campaign_id: string
          content?: string
          created_at?: string
          id?: string
          session_number?: number | null
          submitted_at?: string | null
          submitted_to_summary?: boolean
          title?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string
          content?: string
          created_at?: string
          id?: string
          session_number?: number | null
          submitted_at?: string | null
          submitted_to_summary?: boolean
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_notes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      player_npc_notes: {
        Row: {
          character_id: string
          id: string
          note: string
          npc_id: string
          updated_at: string
        }
        Insert: {
          character_id: string
          id?: string
          note?: string
          npc_id: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          id?: string
          note?: string
          npc_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_npc_notes_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_npc_notes_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "campaign_npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      portrait_bank: {
        Row: {
          created_at: string
          created_by: string | null
          gender: string | null
          id: string
          is_private: boolean
          name: string | null
          number: number | null
          url_256: string
          url_32: string
          url_56: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          gender?: string | null
          id?: string
          is_private?: boolean
          name?: string | null
          number?: number | null
          url_256: string
          url_32: string
          url_56: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          gender?: string | null
          id?: string
          is_private?: boolean
          name?: string | null
          number?: number | null
          url_256?: string
          url_32?: string
          url_56?: string
        }
        Relationships: []
      }
      portrait_counters: {
        Row: {
          count: number
          gender: string
        }
        Insert: {
          count?: number
          gender: string
        }
        Update: {
          count?: number
          gender?: string
        }
        Relationships: []
      }
      pregen_campaign_map: {
        Row: {
          campaign_id: string
          pregen_id: string
        }
        Insert: {
          campaign_id: string
          pregen_id: string
        }
        Update: {
          campaign_id?: string
          pregen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregen_campaign_map_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregen_campaign_map_pregen_id_fkey"
            columns: ["pregen_id"]
            isOneToOne: false
            referencedRelation: "pregen_library"
            referencedColumns: ["id"]
          },
        ]
      }
      pregen_library: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          author_id: string | null
          campaign_id: string | null
          created_at: string
          data: Json
          id: string
          moderation_status: string
          module_id: string | null
          name: string
          portrait_url: string | null
          setting: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          author_id?: string | null
          campaign_id?: string | null
          created_at?: string
          data: Json
          id?: string
          moderation_status?: string
          module_id?: string | null
          name: string
          portrait_url?: string | null
          setting?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          author_id?: string | null
          campaign_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          moderation_status?: string
          module_id?: string | null
          name?: string
          portrait_url?: string | null
          setting?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pregen_library_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregen_library_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pregen_library_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          onboarded: boolean
          role: string
          suspended: boolean
          suspended_reason: string | null
          suspended_until: string | null
          tableau_role: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          onboarded?: boolean
          role?: string
          suspended?: boolean
          suspended_reason?: string | null
          suspended_until?: string | null
          tableau_role?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          onboarded?: boolean
          role?: string
          suspended?: boolean
          suspended_reason?: string | null
          suspended_until?: string | null
          tableau_role?: string | null
          username?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          hour_bucket: string
          user_id: string
        }
        Insert: {
          action: string
          count?: number
          hour_bucket: string
          user_id: string
        }
        Update: {
          action?: string
          count?: number
          hour_bucket?: string
          user_id?: string
        }
        Relationships: []
      }
      roll_log: {
        Row: {
          amod: number | null
          campaign_id: string | null
          character_name: string | null
          cmod: number | null
          coord_chain_id: string | null
          created_at: string | null
          damage_json: Json | null
          die1: number | null
          die2: number | null
          id: string
          insight_awarded: boolean | null
          insight_used: string | null
          label: string | null
          outcome: string | null
          session_id: string | null
          smod: number | null
          target_name: string | null
          total: number | null
          user_id: string | null
        }
        Insert: {
          amod?: number | null
          campaign_id?: string | null
          character_name?: string | null
          cmod?: number | null
          coord_chain_id?: string | null
          created_at?: string | null
          damage_json?: Json | null
          die1?: number | null
          die2?: number | null
          id?: string
          insight_awarded?: boolean | null
          insight_used?: string | null
          label?: string | null
          outcome?: string | null
          session_id?: string | null
          smod?: number | null
          target_name?: string | null
          total?: number | null
          user_id?: string | null
        }
        Update: {
          amod?: number | null
          campaign_id?: string | null
          character_name?: string | null
          cmod?: number | null
          coord_chain_id?: string | null
          created_at?: string | null
          damage_json?: Json | null
          die1?: number | null
          die2?: number | null
          id?: string
          insight_awarded?: boolean | null
          insight_used?: string | null
          label?: string | null
          outcome?: string | null
          session_id?: string | null
          smod?: number | null
          target_name?: string | null
          total?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roll_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roll_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roll_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_tokens: {
        Row: {
          archived_at: string | null
          campaign_id: string | null
          campaign_pin_id: string | null
          character_id: string | null
          color: string | null
          contents: Json
          controlled_by_character_ids: string[]
          created_at: string | null
          current_speed: number | null
          destroyed_portrait_url: string | null
          door_open: boolean
          edited_since_clone: boolean
          grid_h: number
          grid_w: number
          grid_x: number
          grid_y: number
          group_label: string | null
          id: string
          is_door: boolean
          is_visible: boolean | null
          is_wall: boolean
          is_window: boolean
          lootable: boolean
          name: string
          npc_id: string | null
          portrait_url: string | null
          properties: Json
          rotation: number
          scale: number
          scene_id: string
          sight_radius_cells: number
          sort_order: number | null
          source_module_id: string | null
          source_module_version_id: string | null
          token_type: string | null
          wp_current: number | null
          wp_max: number | null
        }
        Insert: {
          archived_at?: string | null
          campaign_id?: string | null
          campaign_pin_id?: string | null
          character_id?: string | null
          color?: string | null
          contents?: Json
          controlled_by_character_ids?: string[]
          created_at?: string | null
          current_speed?: number | null
          destroyed_portrait_url?: string | null
          door_open?: boolean
          edited_since_clone?: boolean
          grid_h?: number
          grid_w?: number
          grid_x?: number
          grid_y?: number
          group_label?: string | null
          id?: string
          is_door?: boolean
          is_visible?: boolean | null
          is_wall?: boolean
          is_window?: boolean
          lootable?: boolean
          name: string
          npc_id?: string | null
          portrait_url?: string | null
          properties?: Json
          rotation?: number
          scale?: number
          scene_id: string
          sight_radius_cells?: number
          sort_order?: number | null
          source_module_id?: string | null
          source_module_version_id?: string | null
          token_type?: string | null
          wp_current?: number | null
          wp_max?: number | null
        }
        Update: {
          archived_at?: string | null
          campaign_id?: string | null
          campaign_pin_id?: string | null
          character_id?: string | null
          color?: string | null
          contents?: Json
          controlled_by_character_ids?: string[]
          created_at?: string | null
          current_speed?: number | null
          destroyed_portrait_url?: string | null
          door_open?: boolean
          edited_since_clone?: boolean
          grid_h?: number
          grid_w?: number
          grid_x?: number
          grid_y?: number
          group_label?: string | null
          id?: string
          is_door?: boolean
          is_visible?: boolean | null
          is_wall?: boolean
          is_window?: boolean
          lootable?: boolean
          name?: string
          npc_id?: string | null
          portrait_url?: string | null
          properties?: Json
          rotation?: number
          scale?: number
          scene_id?: string
          sight_radius_cells?: number
          sort_order?: number | null
          source_module_id?: string | null
          source_module_version_id?: string | null
          token_type?: string | null
          wp_current?: number | null
          wp_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scene_tokens_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_tokens_campaign_pin_id_fkey"
            columns: ["campaign_pin_id"]
            isOneToOne: false
            referencedRelation: "campaign_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_tokens_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "tactical_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_tokens_source_module_id_fkey"
            columns: ["source_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_tokens_source_module_version_id_fkey"
            columns: ["source_module_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          session_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: string
          file_url: string
          id?: string
          session_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          session_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attachments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          campaign_id: string
          cliffhanger: string | null
          created_at: string
          ended_at: string | null
          gm_summary: string | null
          id: string
          next_session_notes: string | null
          session_log: string | null
          session_number: number
          started_at: string
        }
        Insert: {
          campaign_id: string
          cliffhanger?: string | null
          created_at?: string
          ended_at?: string | null
          gm_summary?: string | null
          id?: string
          next_session_notes?: string | null
          session_log?: string | null
          session_number: number
          started_at?: string
        }
        Update: {
          campaign_id?: string
          cliffhanger?: string | null
          created_at?: string
          ended_at?: string | null
          gm_summary?: string | null
          id?: string
          next_session_notes?: string | null
          session_log?: string | null
          session_number?: number
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      setting_seed_handouts: {
        Row: {
          attachments: Json
          content: string
          id: string
          setting: string
          title: string
        }
        Insert: {
          attachments?: Json
          content?: string
          id?: string
          setting: string
          title: string
        }
        Update: {
          attachments?: Json
          content?: string
          id?: string
          setting?: string
          title?: string
        }
        Relationships: []
      }
      setting_seed_npcs: {
        Row: {
          acumen: number
          dexterity: number
          equipment: Json
          id: string
          influence: number
          motivation: string | null
          name: string
          notes: string | null
          npc_type: string | null
          physicality: number
          pin_title: string | null
          portrait_url: string | null
          reason: number
          rp_max: number
          setting: string
          skills: Json
          sort_order: number
          wp_max: number
        }
        Insert: {
          acumen?: number
          dexterity?: number
          equipment?: Json
          id?: string
          influence?: number
          motivation?: string | null
          name: string
          notes?: string | null
          npc_type?: string | null
          physicality?: number
          pin_title?: string | null
          portrait_url?: string | null
          reason?: number
          rp_max?: number
          setting: string
          skills?: Json
          sort_order?: number
          wp_max?: number
        }
        Update: {
          acumen?: number
          dexterity?: number
          equipment?: Json
          id?: string
          influence?: number
          motivation?: string | null
          name?: string
          notes?: string | null
          npc_type?: string | null
          physicality?: number
          pin_title?: string | null
          portrait_url?: string | null
          reason?: number
          rp_max?: number
          setting?: string
          skills?: Json
          sort_order?: number
          wp_max?: number
        }
        Relationships: []
      }
      setting_seed_pins: {
        Row: {
          category: string | null
          id: string
          lat: number
          lng: number
          name: string
          notes: string | null
          setting: string
          sort_order: number
        }
        Insert: {
          category?: string | null
          id?: string
          lat: number
          lng: number
          name: string
          notes?: string | null
          setting: string
          sort_order?: number
        }
        Update: {
          category?: string | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          notes?: string | null
          setting?: string
          sort_order?: number
        }
        Relationships: []
      }
      setting_seed_scenes: {
        Row: {
          background_url: string | null
          grid_cols: number
          grid_rows: number
          id: string
          name: string
          notes: string | null
          setting: string
        }
        Insert: {
          background_url?: string | null
          grid_cols?: number
          grid_rows?: number
          id?: string
          name: string
          notes?: string | null
          setting: string
        }
        Update: {
          background_url?: string | null
          grid_cols?: number
          grid_rows?: number
          id?: string
          name?: string
          notes?: string | null
          setting?: string
        }
        Relationships: []
      }
      signup_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          label: string | null
          max_uses: number
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          label?: string | null
          max_uses?: number
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          label?: string | null
          max_uses?: number
          used_count?: number
        }
        Relationships: []
      }
      tactical_scenes: {
        Row: {
          background_url: string | null
          campaign_id: string
          cell_feet: number
          cell_px: number
          created_at: string | null
          edited_since_clone: boolean
          fog_state: Json
          grid_color: string
          grid_cols: number | null
          grid_opacity: number
          grid_rows: number | null
          has_grid: boolean
          id: string
          img_scale: number | null
          is_active: boolean | null
          is_locked: boolean
          lighting_mode: string
          name: string
          natural_h: number | null
          natural_w: number | null
          reveal_state: Json
          show_grid: boolean
          source_module_id: string | null
          source_module_version_id: string | null
          walls: Json
        }
        Insert: {
          background_url?: string | null
          campaign_id: string
          cell_feet?: number
          cell_px?: number
          created_at?: string | null
          edited_since_clone?: boolean
          fog_state?: Json
          grid_color?: string
          grid_cols?: number | null
          grid_opacity?: number
          grid_rows?: number | null
          has_grid?: boolean
          id?: string
          img_scale?: number | null
          is_active?: boolean | null
          is_locked?: boolean
          lighting_mode?: string
          name?: string
          natural_h?: number | null
          natural_w?: number | null
          reveal_state?: Json
          show_grid?: boolean
          source_module_id?: string | null
          source_module_version_id?: string | null
          walls?: Json
        }
        Update: {
          background_url?: string | null
          campaign_id?: string
          cell_feet?: number
          cell_px?: number
          created_at?: string | null
          edited_since_clone?: boolean
          fog_state?: Json
          grid_color?: string
          grid_cols?: number | null
          grid_opacity?: number
          grid_rows?: number | null
          has_grid?: boolean
          id?: string
          img_scale?: number | null
          is_active?: boolean | null
          is_locked?: boolean
          lighting_mode?: string
          name?: string
          natural_h?: number | null
          natural_w?: number | null
          reveal_state?: Json
          show_grid?: boolean
          source_module_id?: string | null
          source_module_version_id?: string | null
          walls?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tactical_scenes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tactical_scenes_source_module_id_fkey"
            columns: ["source_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tactical_scenes_source_module_version_id_fkey"
            columns: ["source_module_version_id"]
            isOneToOne: false
            referencedRelation: "module_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      visitor_logs: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string
          device_type: string | null
          duration_ms: number | null
          ended_at: string | null
          full_path: string | null
          id: string
          ip_address: string | null
          ip_hash: string | null
          is_ghost: boolean
          language: string | null
          latitude: number | null
          longitude: number | null
          os: string | null
          page: string
          referrer: string | null
          region: string | null
          screen_h: number | null
          screen_w: number | null
          session_id: string
          site: string | null
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          device_type?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          full_path?: string | null
          id?: string
          ip_address?: string | null
          ip_hash?: string | null
          is_ghost?: boolean
          language?: string | null
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          page: string
          referrer?: string | null
          region?: string | null
          screen_h?: number | null
          screen_w?: number | null
          session_id: string
          site?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          device_type?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          full_path?: string | null
          id?: string
          ip_address?: string | null
          ip_hash?: string | null
          is_ghost?: boolean
          language?: string | null
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          page?: string
          referrer?: string | null
          region?: string | null
          screen_h?: number | null
          screen_w?: number | null
          session_id?: string
          site?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      war_stories: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachments: Json
          author_user_id: string | null
          body: string
          campaign_id: string | null
          created_at: string
          id: string
          latest_reply_at: string | null
          moderation_status: string
          moderator_notes: string | null
          reply_count: number
          search_tsv: unknown
          setting: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json
          author_user_id?: string | null
          body: string
          campaign_id?: string | null
          created_at?: string
          id?: string
          latest_reply_at?: string | null
          moderation_status?: string
          moderator_notes?: string | null
          reply_count?: number
          search_tsv?: unknown
          setting?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json
          author_user_id?: string | null
          body?: string
          campaign_id?: string | null
          created_at?: string
          id?: string
          latest_reply_at?: string | null
          moderation_status?: string
          moderator_notes?: string | null
          reply_count?: number
          search_tsv?: unknown
          setting?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "war_stories_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      war_story_reactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          user_id: string
          war_story_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          user_id: string
          war_story_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
          war_story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "war_story_reactions_war_story_id_fkey"
            columns: ["war_story_id"]
            isOneToOne: false
            referencedRelation: "war_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      war_story_replies: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          updated_at: string
          war_story_id: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          updated_at?: string
          war_story_id: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          updated_at?: string
          war_story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "war_story_replies_war_story_id_fkey"
            columns: ["war_story_id"]
            isOneToOne: false
            referencedRelation: "war_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      whispers: {
        Row: {
          author_user_id: string | null
          content: string
          created_at: string
          id: string
        }
        Insert: {
          author_user_id?: string | null
          content: string
          created_at?: string
          id?: string
        }
        Update: {
          author_user_id?: string | null
          content?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      world_communities: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          community_status: string
          created_at: string
          description: string | null
          faction_label: string | null
          homestead_lat: number | null
          homestead_lng: number | null
          id: string
          last_public_update_at: string
          moderation_status: string
          moderator_notes: string | null
          name: string
          published_by: string | null
          size_band: string
          source_campaign_id: string
          source_community_id: string
          subscriber_count: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          community_status?: string
          created_at?: string
          description?: string | null
          faction_label?: string | null
          homestead_lat?: number | null
          homestead_lng?: number | null
          id?: string
          last_public_update_at?: string
          moderation_status?: string
          moderator_notes?: string | null
          name: string
          published_by?: string | null
          size_band?: string
          source_campaign_id: string
          source_community_id: string
          subscriber_count?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          community_status?: string
          created_at?: string
          description?: string | null
          faction_label?: string | null
          homestead_lat?: number | null
          homestead_lng?: number | null
          id?: string
          last_public_update_at?: string
          moderation_status?: string
          moderator_notes?: string | null
          name?: string
          published_by?: string | null
          size_band?: string
          source_campaign_id?: string
          source_community_id?: string
          subscriber_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "world_communities_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_communities_source_community_id_fkey"
            columns: ["source_community_id"]
            isOneToOne: true
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      world_community_links: {
        Row: {
          community_a_id: string
          community_b_id: string
          created_at: string
          id: string
          link_type: string
          narrative: string | null
          proposed_by_user_id: string | null
          proposed_from_community_id: string | null
          responded_at: string | null
          status: string
        }
        Insert: {
          community_a_id: string
          community_b_id: string
          created_at?: string
          id?: string
          link_type: string
          narrative?: string | null
          proposed_by_user_id?: string | null
          proposed_from_community_id?: string | null
          responded_at?: string | null
          status?: string
        }
        Update: {
          community_a_id?: string
          community_b_id?: string
          created_at?: string
          id?: string
          link_type?: string
          narrative?: string | null
          proposed_by_user_id?: string | null
          proposed_from_community_id?: string | null
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_community_links_community_a_id_fkey"
            columns: ["community_a_id"]
            isOneToOne: false
            referencedRelation: "world_communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_community_links_community_b_id_fkey"
            columns: ["community_b_id"]
            isOneToOne: false
            referencedRelation: "world_communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_community_links_proposed_from_community_id_fkey"
            columns: ["proposed_from_community_id"]
            isOneToOne: false
            referencedRelation: "world_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      world_npcs: {
        Row: {
          acumen: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          dexterity: number
          id: string
          import_count: number
          influence: number
          name: string
          npc_type: string | null
          physicality: number
          portrait_url: string | null
          public_description: string | null
          reason: number
          setting: string | null
          skills: Json
          source_campaign_npc_id: string | null
          status: string
        }
        Insert: {
          acumen?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          dexterity?: number
          id?: string
          import_count?: number
          influence?: number
          name: string
          npc_type?: string | null
          physicality?: number
          portrait_url?: string | null
          public_description?: string | null
          reason?: number
          setting?: string | null
          skills?: Json
          source_campaign_npc_id?: string | null
          status?: string
        }
        Update: {
          acumen?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          dexterity?: number
          id?: string
          import_count?: number
          influence?: number
          name?: string
          npc_type?: string | null
          physicality?: number
          portrait_url?: string | null
          public_description?: string | null
          reason?: number
          setting?: string | null
          skills?: Json
          source_campaign_npc_id?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_user_with_login: {
        Args: { target_user_id: string }
        Returns: {
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
          role: string
          suspended_reason: string
          suspended_until: string
          username: string
        }[]
      }
      admin_users_with_login: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
          role: string
          suspended_reason: string
          suspended_until: string
          username: string
        }[]
      }
      apply_barter_trade: {
        Args: {
          p_pc_character_id: string
          p_pc_gets: Json
          p_pc_gives: Json
          p_target_id: string
          p_target_kind: string
        }
        Returns: undefined
      }
      auto_end_stale_sessions: {
        Args: { stale_hours?: number }
        Returns: number
      }
      bump_npc_relationship_cmod: {
        Args: {
          p_character_id: string
          p_clamp_max?: number
          p_clamp_min?: number
          p_delta: number
          p_npc_id: string
          p_reveal_level?: string
          p_set_revealed?: boolean
        }
        Returns: undefined
      }
      call_notify_thriver: {
        Args: {
          p_body: string
          p_link?: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      check_rate_limit: {
        Args: { p_action: string; p_max_per_hour: number }
        Returns: boolean
      }
      clone_module_pregens_into_campaign: {
        Args: { p_campaign_id: string; p_module_id: string; p_pregens: Json }
        Returns: number
      }
      find_campaign_by_invite_code: {
        Args: { p_code: string }
        Returns: {
          cover_image_url: string
          description: string
          gm_user_id: string
          id: string
          name: string
          setting: string
        }[]
      }
      get_campaign_invite_code: {
        Args: { p_campaign_id: string }
        Returns: string
      }
      get_campaign_module_cover: {
        Args: { p_campaign_id: string }
        Returns: string
      }
      get_latest_messages_for_conversations: {
        Args: { conv_ids: string[] }
        Returns: {
          body: string
          conversation_id: string
          created_at: string
          sender_user_id: string
        }[]
      }
      get_or_create_dm: { Args: { other_user_id: string }; Returns: string }
      get_profile_email: { Args: { p_user_id: string }; Returns: string }
      get_visitor_map_data:
        | {
            Args: never
            Returns: {
              city: string
              country_code: string
              first_visit: string
              ip_hash: string
              is_ghost: boolean
              last_visit: string
              lat: number
              lng: number
              visit_count: number
            }[]
          }
        | {
            Args: { p_site?: string }
            Returns: {
              city: string
              country_code: string
              first_visit: string
              ip_hash: string
              is_ghost: boolean
              last_visit: string
              lat: number
              lng: number
              visit_count: number
            }[]
          }
      give_item_character_to_community: {
        Args: {
          p_giver_character_id: string
          p_item_custom: boolean
          p_item_enc?: number
          p_item_name: string
          p_item_notes?: string
          p_item_rarity?: string
          p_qty: number
          p_target_community_id: string
        }
        Returns: undefined
      }
      give_item_character_to_npc: {
        Args: {
          p_giver_character_id: string
          p_item_custom: boolean
          p_item_name: string
          p_qty: number
          p_target_npc_id: string
        }
        Returns: undefined
      }
      give_item_character_to_vehicle: {
        Args: {
          p_campaign_id: string
          p_giver_character_id: string
          p_item_custom: boolean
          p_item_name: string
          p_qty: number
          p_vehicle_id: string
        }
        Returns: undefined
      }
      give_item_npc_to_character: {
        Args: {
          p_giver_npc_id: string
          p_item_custom: boolean
          p_item_name: string
          p_qty: number
          p_target_character_id: string
        }
        Returns: undefined
      }
      give_item_to_character: {
        Args: {
          p_giver_id: string
          p_item_custom: boolean
          p_item_name: string
          p_qty: number
          p_target_id: string
        }
        Returns: undefined
      }
      gm_apply_damage: {
        Args: {
          p_campaign_id: string
          p_infection_risk?: boolean
          p_target_id: string
          p_target_kind: string
          p_wp_damage: number
        }
        Returns: Json
      }
      increment_portrait_counter: { Args: { g: string }; Returns: number }
      is_campaign_member: { Args: { p_campaign_id: string }; Returns: boolean }
      is_thriver: { Args: never; Returns: boolean }
      is_user_suspended: { Args: never; Returns: boolean }
      join_campaign_by_invite_code: {
        Args: { p_code: string; p_observer?: boolean }
        Returns: {
          cover_image_url: string
          description: string
          gm_user_id: string
          id: string
          name: string
          setting: string
        }[]
      }
      loot_npc_equipment_item: {
        Args: {
          p_character_id: string
          p_npc_id: string
          p_weapon_slot: string
        }
        Returns: Json
      }
      loot_npc_item: {
        Args: {
          p_character_id: string
          p_item_custom?: boolean
          p_item_name: string
          p_npc_id: string
          p_qty?: number
        }
        Returns: Json
      }
      my_conversation_ids: { Args: never; Returns: string[] }
      notify_inventory_received: {
        Args: {
          from_label: string
          item_name: string
          item_qty: number
          target_character_id: string
        }
        Returns: undefined
      }
      random_portrait: {
        Args: { g: string }
        Returns: {
          gender: string
          id: string
          number: number
          url_256: string
          url_32: string
          url_56: string
        }[]
      }
      rate_limits_purge_old: { Args: never; Returns: undefined }
      redeem_signup_code: { Args: { p_code: string }; Returns: boolean }
      snap_token_to_seat: {
        Args: {
          p_assignee_id: string
          p_kind: string
          p_scene_id: string
          p_target_x: number
          p_target_y: number
        }
        Returns: undefined
      }
      toggle_wall_segment_door: {
        Args: { p_open: boolean; p_scene_id: string; p_segment_id: string }
        Returns: undefined
      }
      update_vehicle_in_campaign: {
        Args: { p_campaign_id: string; p_patch: Json; p_vehicle_id: string }
        Returns: undefined
      }
      withdraw_item_community_to_character: {
        Args: {
          p_community_id: string
          p_item_custom: boolean
          p_item_name: string
          p_qty: number
          p_target_character_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
