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
      chapters: {
        Row: {
          date: string
          number: number
          photo_url: string | null
          scripture_ref: string | null
          scripture_text: string | null
          sort_order: number
          summary: string
          title: string
          visible: boolean
        }
        Insert: {
          date: string
          number: number
          photo_url?: string | null
          scripture_ref?: string | null
          scripture_text?: string | null
          sort_order?: number
          summary?: string
          title: string
          visible?: boolean
        }
        Update: {
          date?: string
          number?: number
          photo_url?: string | null
          scripture_ref?: string | null
          scripture_text?: string | null
          sort_order?: number
          summary?: string
          title?: string
          visible?: boolean
        }
        Relationships: []
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
          created_at: string
          display_name: string
          email: string
          full_name: string
          id: string
          photo_url: string | null
          splitwise_name: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          full_name: string
          id?: string
          photo_url?: string | null
          splitwise_name?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          full_name?: string
          id?: string
          photo_url?: string | null
          splitwise_name?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
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
      scenes: {
        Row: {
          chapter_number: number
          details: string
          end_time: string | null
          experience_card: string | null
          id: string
          kind: string
          leave_at: string | null
          location: string
          scene_order: number
          start_time: string | null
          summary: string
          title: string
          updated_at: string
          visible: boolean
          wardrobe_look: number | null
        }
        Insert: {
          chapter_number: number
          details?: string
          end_time?: string | null
          experience_card?: string | null
          id?: string
          kind?: string
          leave_at?: string | null
          location?: string
          scene_order: number
          start_time?: string | null
          summary?: string
          title: string
          updated_at?: string
          visible?: boolean
          wardrobe_look?: number | null
        }
        Update: {
          chapter_number?: number
          details?: string
          end_time?: string | null
          experience_card?: string | null
          id?: string
          kind?: string
          leave_at?: string | null
          location?: string
          scene_order?: number
          start_time?: string | null
          summary?: string
          title?: string
          updated_at?: string
          visible?: boolean
          wardrobe_look?: number | null
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
      can_edit_itinerary: { Args: { _user_id: string }; Returns: boolean }
      can_view_itinerary: { Args: { _user_id: string }; Returns: boolean }
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
      link_guest: {
        Args: { _email: string; _user_id: string }
        Returns: undefined
      }
      my_profile: {
        Args: never
        Returns: {
          display_name: string
        }[]
      }
      set_schedule_manager: {
        Args: { _enabled: boolean; _guest_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "host" | "schedule_manager" | "trip_guest" | "friend_afar"
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
      app_role: ["host", "schedule_manager", "trip_guest", "friend_afar"],
    },
  },
} as const
