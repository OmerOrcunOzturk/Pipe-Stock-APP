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
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: Database["public"]["Enums"]["pipe_category"]
          created_at: string
          created_by: string | null
          diameter_mm: number
          id: string
          is_active: boolean
          material: string
          name: string | null
          pressure_class: string
          standard_length_m: number
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["pipe_category"]
          created_at?: string
          created_by?: string | null
          diameter_mm: number
          id?: string
          is_active?: boolean
          material: string
          name?: string | null
          pressure_class: string
          standard_length_m: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["pipe_category"]
          created_at?: string
          created_by?: string | null
          diameter_mm?: number
          id?: string
          is_active?: boolean
          material?: string
          name?: string | null
          pressure_class?: string
          standard_length_m?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      stock_balances: {
        Row: {
          meters: number
          pieces: number
          product_id: string
          updated_at: string
        }
        Insert: {
          meters?: number
          pieces?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          meters?: number
          pieces?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_stock_balances"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "v_stock_reconciliation"
            referencedColumns: ["product_id"]
          },
        ]
      }
      stock_documents: {
        Row: {
          cancels_document_id: string | null
          client_request_id: string
          created_at: string
          created_by: string
          doc_date: string
          doc_no: number
          doc_type: Database["public"]["Enums"]["stock_doc_type"]
          driver_name: string
          id: string
          note: string
          receiver_name: string
          status: Database["public"]["Enums"]["stock_doc_status"]
          supplier: string
          vehicle_plate: string
          village_id: string | null
          waybill_no: string
        }
        Insert: {
          cancels_document_id?: string | null
          client_request_id: string
          created_at?: string
          created_by: string
          doc_date: string
          doc_no?: never
          doc_type: Database["public"]["Enums"]["stock_doc_type"]
          driver_name?: string
          id?: string
          note?: string
          receiver_name?: string
          status?: Database["public"]["Enums"]["stock_doc_status"]
          supplier?: string
          vehicle_plate?: string
          village_id?: string | null
          waybill_no?: string
        }
        Update: {
          cancels_document_id?: string | null
          client_request_id?: string
          created_at?: string
          created_by?: string
          doc_date?: string
          doc_no?: never
          doc_type?: Database["public"]["Enums"]["stock_doc_type"]
          driver_name?: string
          id?: string
          note?: string
          receiver_name?: string
          status?: Database["public"]["Enums"]["stock_doc_status"]
          supplier?: string
          vehicle_plate?: string
          village_id?: string | null
          waybill_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_documents_cancels_document_id_fkey"
            columns: ["cancels_document_id"]
            isOneToOne: true
            referencedRelation: "stock_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_documents_cancels_document_id_fkey"
            columns: ["cancels_document_id"]
            isOneToOne: true
            referencedRelation: "v_movement_details"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "stock_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_documents_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          document_id: string
          id: number
          product_id: string
          qty_meters: number
          qty_pieces: number
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: never
          product_id: string
          qty_meters: number
          qty_pieces: number
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: never
          product_id?: string
          qty_meters?: number
          qty_pieces?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "stock_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "v_movement_details"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_balances"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_reconciliation"
            referencedColumns: ["product_id"]
          },
        ]
      }
      villages: {
        Row: {
          created_at: string
          created_by: string | null
          district: string
          id: string
          is_active: boolean
          muhtar_name: string
          name: string
          note: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          district?: string
          id?: string
          is_active?: boolean
          muhtar_name?: string
          name: string
          note?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          district?: string
          id?: string
          is_active?: boolean
          muhtar_name?: string
          name?: string
          note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "villages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_movement_details: {
        Row: {
          category: Database["public"]["Enums"]["pipe_category"] | null
          created_at: string | null
          created_by_name: string | null
          district: string | null
          doc_date: string | null
          doc_no: number | null
          doc_type: Database["public"]["Enums"]["stock_doc_type"] | null
          document_id: string | null
          driver_name: string | null
          movement_id: number | null
          note: string | null
          product_id: string | null
          product_name: string | null
          qty_meters: number | null
          qty_pieces: number | null
          receiver_name: string | null
          status: Database["public"]["Enums"]["stock_doc_status"] | null
          supplier: string | null
          vehicle_plate: string | null
          village_id: string | null
          village_name: string | null
          waybill_no: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_documents_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_balances"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_reconciliation"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_stock_balances: {
        Row: {
          category: Database["public"]["Enums"]["pipe_category"] | null
          diameter_mm: number | null
          is_active: boolean | null
          material: string | null
          meters: number | null
          name: string | null
          pieces: number | null
          pressure_class: string | null
          product_id: string | null
          standard_length_m: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_stock_reconciliation: {
        Row: {
          balance_meters: number | null
          balance_pieces: number | null
          movement_meters: number | null
          movement_pieces: number | null
          name: string | null
          product_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _post_stock_document: {
        Args: {
          p_cancels_document_id: string
          p_client_request_id: string
          p_doc_date: string
          p_doc_type: Database["public"]["Enums"]["stock_doc_type"]
          p_driver_name: string
          p_lines: Json
          p_note: string
          p_receiver_name: string
          p_supplier: string
          p_vehicle_plate: string
          p_village_id: string
          p_waybill_no: string
        }
        Returns: string
      }
      _require_role: {
        Args: { p_roles: Database["public"]["Enums"]["user_role"][] }
        Returns: undefined
      }
      _signed_lines: { Args: { p_lines: Json; p_sign: number }; Returns: Json }
      admin_create_user: {
        Args: {
          p_email: string
          p_full_name: string
          p_password: string
          p_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: string
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_sign_in_at: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      admin_set_user_access: {
        Args: {
          p_is_active: boolean
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_user_password: {
        Args: { p_password: string; p_user_id: string }
        Returns: undefined
      }
      admin_update_user: {
        Args: {
          p_full_name: string
          p_is_active: boolean
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_document: {
        Args: {
          p_client_request_id: string
          p_document_id: string
          p_reason: string
        }
        Returns: string
      }
      create_adjustment: {
        Args: {
          p_client_request_id: string
          p_doc_date: string
          p_lines: Json
          p_note: string
        }
        Returns: string
      }
      create_distribution: {
        Args: {
          p_client_request_id: string
          p_doc_date: string
          p_driver_name: string
          p_lines: Json
          p_note: string
          p_receiver_name: string
          p_vehicle_plate: string
          p_village_id: string
          p_waybill_no: string
        }
        Returns: string
      }
      create_receipt: {
        Args: {
          p_client_request_id: string
          p_doc_date: string
          p_lines: Json
          p_note: string
          p_supplier: string
          p_waybill_no: string
        }
        Returns: string
      }
      create_return: {
        Args: {
          p_client_request_id: string
          p_doc_date: string
          p_lines: Json
          p_note: string
          p_village_id: string
          p_waybill_no: string
        }
        Returns: string
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      delete_product: { Args: { p_product_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      report_product_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          adjusted_meters: number
          adjusted_pieces: number
          balance_meters: number
          balance_pieces: number
          category: Database["public"]["Enums"]["pipe_category"]
          diameter_mm: number
          distributed_meters: number
          distributed_pieces: number
          is_active: boolean
          product_id: string
          product_name: string
          received_meters: number
          received_pieces: number
          returned_meters: number
          returned_pieces: number
        }[]
      }
      report_village_distribution: {
        Args: { p_from: string; p_to: string }
        Returns: {
          category: Database["public"]["Enums"]["pipe_category"]
          diameter_mm: number
          district: string
          document_count: number
          meters: number
          pieces: number
          product_id: string
          product_name: string
          village_id: string
          village_name: string
        }[]
      }
      today_tr: { Args: never; Returns: string }
    }
    Enums: {
      pipe_category: "icme_suyu" | "korige"
      stock_doc_status: "aktif" | "iptal_edildi"
      stock_doc_type: "giris" | "dagitim" | "iade" | "duzeltme" | "iptal"
      user_role: "admin" | "depo" | "izleyici"
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
      pipe_category: ["icme_suyu", "korige"],
      stock_doc_status: ["aktif", "iptal_edildi"],
      stock_doc_type: ["giris", "dagitim", "iade", "duzeltme", "iptal"],
      user_role: ["admin", "depo", "izleyici"],
    },
  },
} as const
