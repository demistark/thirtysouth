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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      afar_attempts: {
        Row: {
          address: string
          attempted_at: string
          id: number
        }
        Insert: {
          address: string
          attempted_at?: string
          id?: never
        }
        Update: {
          address?: string
          attempted_at?: string
          id?: never
        }
        Relationships: []
      }
      afar_codes: {
        Row: {
          code_hash: string
          disabled: boolean
          guest_id: string
          issued_at: string
          last_signed_in_at: string | null
          salt: string
        }
        Insert: {
          code_hash: string
          disabled?: boolean
          guest_id: string
          issued_at?: string
          last_signed_in_at?: string | null
          salt: string
        }
        Update: {
          code_hash?: string
          disabled?: boolean
          guest_id?: string
          issued_at?: string
          last_signed_in_at?: string | null
          salt?: string
        }
        Relationships: [
          {
            foreignKeyName: "afar_codes_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: true
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          date: string
          heading_before: string | null
          heading_before_align: string | null
          layout: string | null
          number: number
          photo_url: string | null
          scripture_ref: string | null
          scripture_text: string | null
          sort_order: number
          summary: string
          title: string
          transition_after: string | null
          transition_after_align: string | null
          visible: boolean
        }
        Insert: {
          date: string
          heading_before?: string | null
          heading_before_align?: string | null
          layout?: string | null
          number: number
          photo_url?: string | null
          scripture_ref?: string | null
          scripture_text?: string | null
          sort_order?: number
          summary?: string
          title: string
          transition_after?: string | null
          transition_after_align?: string | null
          visible?: boolean
        }
        Update: {
          date?: string
          heading_before?: string | null
          heading_before_align?: string | null
          layout?: string | null
          number?: number
          photo_url?: string | null
          scripture_ref?: string | null
          scripture_text?: string | null
          sort_order?: number
          summary?: string
          title?: string
          transition_after?: string | null
          transition_after_align?: string | null
          visible?: boolean
        }
        Relationships: []
      }
      commons_posts: {
        Row: {
          author_guest_id: string
          body: string | null
          card_style: string
          created_at: string
          edited_at: string
          frame_no: number | null
          hidden: boolean
          id: string
          page_number: number | null
          photo_h: number | null
          photo_path: string | null
          photo_w: number | null
          request_id: string
          size_pct: number
          stamp: boolean
          tilt_deg: number
          tint: string | null
        }
        Insert: {
          author_guest_id: string
          body?: string | null
          card_style: string
          created_at?: string
          edited_at?: string
          frame_no?: number | null
          hidden?: boolean
          id?: string
          page_number?: number | null
          photo_h?: number | null
          photo_path?: string | null
          photo_w?: number | null
          request_id: string
          size_pct: number
          stamp?: boolean
          tilt_deg?: number
          tint?: string | null
        }
        Update: {
          author_guest_id?: string
          body?: string | null
          card_style?: string
          created_at?: string
          edited_at?: string
          frame_no?: number | null
          hidden?: boolean
          id?: string
          page_number?: number | null
          photo_h?: number | null
          photo_path?: string | null
          photo_w?: number | null
          request_id?: string
          size_pct?: number
          stamp?: boolean
          tilt_deg?: number
          tint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commons_posts_author_guest_id_fkey"
            columns: ["author_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_verses: {
        Row: {
          chapter_number: number
          reference: string
          text: string
        }
        Insert: {
          chapter_number: number
          reference?: string
          text?: string
        }
        Update: {
          chapter_number?: number
          reference?: string
          text?: string
        }
        Relationships: []
      }
      experience_rsvps: {
        Row: {
          choice: string | null
          experience_id: string
          guest_id: string
          status: string
          updated_at: string
        }
        Insert: {
          choice?: string | null
          experience_id: string
          guest_id: string
          status: string
          updated_at?: string
        }
        Update: {
          choice?: string | null
          experience_id?: string
          guest_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_rsvps_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_rsvps_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_scenes: {
        Row: {
          experience_id: string
          scene_id: string
        }
        Insert: {
          experience_id: string
          scene_id: string
        }
        Update: {
          experience_id?: string
          scene_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_scenes_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_scenes_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      experiences: {
        Row: {
          card: string
          choices: string | null
          created_at: string
          default_status: string | null
          details: string | null
          id: string
          level: string
          location: string | null
          parent_id: string | null
          price_note: string | null
          price_status: string | null
          price_zar: number | null
          rank: string
          rsvp_deadline: string | null
          rsvp_mode: string
          show_host_note: boolean
          sort_order: number
          summary: string
          updated_at: string
          visible: boolean
          when_text: string
        }
        Insert: {
          card: string
          choices?: string | null
          created_at?: string
          default_status?: string | null
          details?: string | null
          id?: string
          level?: string
          location?: string | null
          parent_id?: string | null
          price_note?: string | null
          price_status?: string | null
          price_zar?: number | null
          rank?: string
          rsvp_deadline?: string | null
          rsvp_mode?: string
          show_host_note?: boolean
          sort_order?: number
          summary?: string
          updated_at?: string
          visible?: boolean
          when_text?: string
        }
        Update: {
          card?: string
          choices?: string | null
          created_at?: string
          default_status?: string | null
          details?: string | null
          id?: string
          level?: string
          location?: string | null
          parent_id?: string | null
          price_note?: string | null
          price_status?: string | null
          price_zar?: number | null
          rank?: string
          rsvp_deadline?: string | null
          rsvp_mode?: string
          show_host_note?: boolean
          sort_order?: number
          summary?: string
          updated_at?: string
          visible?: boolean
          when_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiences_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_facts: {
        Row: {
          active: boolean
          created_at: string
          id: string
          text: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          text: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          text?: string
        }
        Relationships: []
      }
      guests: {
        Row: {
          cast_order: number | null
          cast_role_override: string | null
          created_at: string
          display_name: string
          email: string
          full_name: string
          id: string
          pending_role: Database["public"]["Enums"]["app_role"] | null
          photo_url: string | null
          pronoun_form: string | null
          splitwise_name: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          cast_order?: number | null
          cast_role_override?: string | null
          created_at?: string
          display_name: string
          email: string
          full_name: string
          id?: string
          pending_role?: Database["public"]["Enums"]["app_role"] | null
          photo_url?: string | null
          pronoun_form?: string | null
          splitwise_name?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          cast_order?: number | null
          cast_role_override?: string | null
          created_at?: string
          display_name?: string
          email?: string
          full_name?: string
          id?: string
          pending_role?: Database["public"]["Enums"]["app_role"] | null
          photo_url?: string | null
          pronoun_form?: string | null
          splitwise_name?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      heart_cards: {
        Row: {
          author_guest_id: string
          body: string
          city: string | null
          created_at: string
          edited_at: string
          hidden: boolean
          id: string
          photo_h: number | null
          photo_path: string | null
          photo_w: number | null
          pinned: boolean
          pinned_at: string | null
          request_id: string
          tilt_deg: number
        }
        Insert: {
          author_guest_id: string
          body: string
          city?: string | null
          created_at?: string
          edited_at?: string
          hidden?: boolean
          id?: string
          photo_h?: number | null
          photo_path?: string | null
          photo_w?: number | null
          pinned?: boolean
          pinned_at?: string | null
          request_id: string
          tilt_deg?: number
        }
        Update: {
          author_guest_id?: string
          body?: string
          city?: string | null
          created_at?: string
          edited_at?: string
          hidden?: boolean
          id?: string
          photo_h?: number | null
          photo_path?: string | null
          photo_w?: number | null
          pinned?: boolean
          pinned_at?: string | null
          request_id?: string
          tilt_deg?: number
        }
        Relationships: [
          {
            foreignKeyName: "heart_cards_author_guest_id_fkey"
            columns: ["author_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      home_images: {
        Row: {
          alt: string
          focal_x: number
          focal_y: number
          slot: string
          storage_path: string
        }
        Insert: {
          alt?: string
          focal_x?: number
          focal_y?: number
          slot: string
          storage_path: string
        }
        Update: {
          alt?: string
          focal_x?: number
          focal_y?: number
          slot?: string
          storage_path?: string
        }
        Relationships: []
      }
      packing_categories: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      packing_checks: {
        Row: {
          checked_at: string
          item_id: string
          user_id: string
        }
        Insert: {
          checked_at?: string
          item_id: string
          user_id: string
        }
        Update: {
          checked_at?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_checks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "packing_items"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_items: {
        Row: {
          category_id: string
          chapter_number: number | null
          id: string
          look_order: number | null
          name: string
          note: string | null
          sort_order: number
          visible: boolean
        }
        Insert: {
          category_id: string
          chapter_number?: number | null
          id?: string
          look_order?: number | null
          name: string
          note?: string | null
          sort_order?: number
          visible?: boolean
        }
        Update: {
          category_id?: string
          chapter_number?: number | null
          id?: string
          look_order?: number | null
          name?: string
          note?: string | null
          sort_order?: number
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "packing_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "packing_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_items_chapter_number_fkey"
            columns: ["chapter_number"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["number"]
          },
        ]
      }
      private_content: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      reflection_entries: {
        Row: {
          body: string
          created_at: string
          entry_date: string
          guest_id: string
          id: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          entry_date: string
          guest_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          entry_date?: string
          guest_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reflection_entries_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      role_invites: {
        Row: {
          email: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          email: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          email?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      room_assignments: {
        Row: {
          guest_id: string
          room_id: string
        }
        Insert: {
          guest_id: string
          room_id: string
        }
        Update: {
          guest_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_assignments_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: true
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "villa_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          call_time: string | null
          chapter_number: number
          details: string
          dot_color: string | null
          dot_shape: string | null
          end_time: string | null
          experience_card: string | null
          home_highlight: boolean
          id: string
          kind: string
          leave_at: string | null
          location: string
          look_tag: string
          scene_order: number
          start_time: string | null
          summary: string
          title: string
          updated_at: string
          visible: boolean
          wardrobe_look: number | null
          wrap_time: string | null
        }
        Insert: {
          call_time?: string | null
          chapter_number: number
          details?: string
          dot_color?: string | null
          dot_shape?: string | null
          end_time?: string | null
          experience_card?: string | null
          home_highlight?: boolean
          id?: string
          kind?: string
          leave_at?: string | null
          location?: string
          look_tag?: string
          scene_order: number
          start_time?: string | null
          summary?: string
          title: string
          updated_at?: string
          visible?: boolean
          wardrobe_look?: number | null
          wrap_time?: string | null
        }
        Update: {
          call_time?: string | null
          chapter_number?: number
          details?: string
          dot_color?: string | null
          dot_shape?: string | null
          end_time?: string | null
          experience_card?: string | null
          home_highlight?: boolean
          id?: string
          kind?: string
          leave_at?: string | null
          location?: string
          look_tag?: string
          scene_order?: number
          start_time?: string | null
          summary?: string
          title?: string
          updated_at?: string
          visible?: boolean
          wardrobe_look?: number | null
          wrap_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenes_chapter_number_fkey"
            columns: ["chapter_number"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["number"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          direction: string
          driver_contact: string | null
          id: string
          included_with_villa: boolean
          label: string
          meet_time: string | null
          meeting_point: string | null
          notes: string | null
          provider: string | null
          sort_order: number
          visible: boolean
        }
        Insert: {
          direction: string
          driver_contact?: string | null
          id?: string
          included_with_villa?: boolean
          label: string
          meet_time?: string | null
          meeting_point?: string | null
          notes?: string | null
          provider?: string | null
          sort_order?: number
          visible?: boolean
        }
        Update: {
          direction?: string
          driver_contact?: string | null
          id?: string
          included_with_villa?: boolean
          label?: string
          meet_time?: string | null
          meeting_point?: string | null
          notes?: string | null
          provider?: string | null
          sort_order?: number
          visible?: boolean
        }
        Relationships: []
      }
      travel_images: {
        Row: {
          alt: string
          caption: string | null
          focal_x: number
          focal_y: number
          slot: string
          storage_path: string
        }
        Insert: {
          alt?: string
          caption?: string | null
          focal_x?: number
          focal_y?: number
          slot: string
          storage_path: string
        }
        Update: {
          alt?: string
          caption?: string | null
          focal_x?: number
          focal_y?: number
          slot?: string
          storage_path?: string
        }
        Relationships: []
      }
      travel_legs: {
        Row: {
          airline: string
          connections: string[]
          cpt_time: string
          created_at: string
          direction: string
          flight_number: string
          guest_id: string
          id: string
          notes: string | null
          other_airport: string
          terminal: string | null
          transfer_id: string | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          airline?: string
          connections?: string[]
          cpt_time: string
          created_at?: string
          direction: string
          flight_number?: string
          guest_id: string
          id?: string
          notes?: string | null
          other_airport?: string
          terminal?: string | null
          transfer_id?: string | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          airline?: string
          connections?: string[]
          cpt_time?: string
          created_at?: string
          direction?: string
          flight_number?: string
          guest_id?: string
          id?: string
          notes?: string | null
          other_airport?: string
          terminal?: string | null
          transfer_id?: string | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "travel_legs_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_legs_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_roomies: {
        Row: {
          floor_room: string
          id: string
          names: string
          note: string
          sort_order: number
        }
        Insert: {
          floor_room?: string
          id?: string
          names?: string
          note?: string
          sort_order?: number
        }
        Update: {
          floor_room?: string
          id?: string
          names?: string
          note?: string
          sort_order?: number
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
      villa_rooms: {
        Row: {
          bed_config: string
          id: string
          label: string
          level: string | null
          notes: string | null
          sleeps: number
          sort_order: number
        }
        Insert: {
          bed_config?: string
          id?: string
          label: string
          level?: string | null
          notes?: string | null
          sleeps?: number
          sort_order?: number
        }
        Update: {
          bed_config?: string
          id?: string
          label?: string
          level?: string | null
          notes?: string | null
          sleeps?: number
          sort_order?: number
        }
        Relationships: []
      }
      wardrobe_looks: {
        Row: {
          chapter_number: number
          date_label: string
          description: string
          id: string
          look_label: string
          look_order: number
          palette: Json
          photos: Json
          title: string
          visible: boolean
        }
        Insert: {
          chapter_number: number
          date_label?: string
          description?: string
          id?: string
          look_label?: string
          look_order: number
          palette?: Json
          photos?: Json
          title: string
          visible?: boolean
        }
        Update: {
          chapter_number?: number
          date_label?: string
          description?: string
          id?: string
          look_label?: string
          look_order?: number
          palette?: Json
          photos?: Json
          title?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "wardrobe_looks_chapter_number_fkey"
            columns: ["chapter_number"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["number"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      afar_session_valid: { Args: never; Returns: boolean }
      can_edit_itinerary: { Args: { _user_id: string }; Returns: boolean }
      can_edit_journal: { Args: { _user_id: string }; Returns: boolean }
      can_edit_purse: { Args: { _user_id: string }; Returns: boolean }
      can_edit_travel: { Args: { _user_id: string }; Returns: boolean }
      can_view_itinerary: { Args: { _user_id: string }; Returns: boolean }
      can_view_journal: { Args: { _user_id: string }; Returns: boolean }
      can_view_private_content: { Args: { _user_id: string }; Returns: boolean }
      can_view_purse: { Args: { _user_id: string }; Returns: boolean }
      can_view_travel: { Args: { _user_id: string }; Returns: boolean }
      cast_list: {
        Args: never
        Returns: {
          cast_order: number
          cast_role_override: string
          display_name: string
          full_name: string
          id: string
          pronoun_form: string
        }[]
      }
      create_commons_post: {
        Args: {
          _body: string
          _card_style: string
          _frame_no: number
          _page_number: number
          _photo_h: number
          _photo_path: string
          _photo_w: number
          _request_id: string
          _size_pct: number
          _stamp: boolean
          _tilt_deg: number
          _tint: string
        }
        Returns: {
          author_guest_id: string
          body: string | null
          card_style: string
          created_at: string
          edited_at: string
          frame_no: number | null
          hidden: boolean
          id: string
          page_number: number | null
          photo_h: number | null
          photo_path: string | null
          photo_w: number | null
          request_id: string
          size_pct: number
          stamp: boolean
          tilt_deg: number
          tint: string | null
        }
        SetofOptions: {
          from: "*"
          to: "commons_posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_heart_card: {
        Args: {
          _body: string
          _city: string
          _photo_h: number
          _photo_path: string
          _photo_w: number
          _request_id: string
          _tilt_deg: number
        }
        Returns: {
          author_guest_id: string
          body: string
          city: string | null
          created_at: string
          edited_at: string
          hidden: boolean
          id: string
          photo_h: number | null
          photo_path: string | null
          photo_w: number | null
          pinned: boolean
          pinned_at: string | null
          request_id: string
          tilt_deg: number
        }
        SetofOptions: {
          from: "*"
          to: "heart_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_phase: { Args: never; Returns: string }
      ensure_cast_order: { Args: never; Returns: undefined }
      guest_directory: {
        Args: never
        Returns: {
          display_name: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_invited: { Args: { _email: string }; Returns: boolean }
      is_trip_participant: { Args: { _user_id: string }; Returns: boolean }
      journal_level: { Args: { _user_id: string }; Returns: string }
      link_guest: {
        Args: { _email: string; _user_id: string }
        Returns: undefined
      }
      my_guest: { Args: never; Returns: string }
      my_profile: {
        Args: never
        Returns: {
          display_name: string
        }[]
      }
      participant_directory: {
        Args: never
        Returns: {
          display_name: string
          id: string
        }[]
      }
      rsvp_open: { Args: { _experience_id: string }; Returns: boolean }
      save_itinerary_display: {
        Args: { _grain: boolean; _indicator: string; _shadow: number }
        Returns: undefined
      }
      set_guest_role: {
        Args: {
          _guest_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      set_schedule_manager: {
        Args: { _enabled: boolean; _guest_id: string }
        Returns: undefined
      }
      travel_share_all: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "host"
        | "schedule_manager"
        | "trip_guest"
        | "friend_afar"
        | "honorary_guest"
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
        "host",
        "schedule_manager",
        "trip_guest",
        "friend_afar",
        "honorary_guest",
      ],
    },
  },
} as const
