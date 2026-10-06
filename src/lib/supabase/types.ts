/**
 * Hand-written mirror of supabase/migrations. Once the project is linked you
 * can replace this file wholesale with:
 *
 *   npx supabase gen types typescript --linked > src/lib/supabase/types.ts
 *
 * Until then it is the single source of truth for query typing, so keep it in
 * step with the migrations.
 */

export type FixtureStage =
  | "group"
  | "playoff"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "third_place"
  | "final";

export type FixtureStatus = "upcoming" | "live" | "finished";

export type AnnouncementType = "delay" | "schedule" | "notice" | "result";

type Timestamptz = string;

export interface Database {
  public: {
    Tables: {
      sports: {
        Row: {
          id: string;
          slug: string;
          name: string;
          code: string;
          color: string;
          sort_order: number;
          created_at: Timestamptz;
        };
        Insert: Omit<Database["public"]["Tables"]["sports"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: Timestamptz;
        };
        Update: Partial<Database["public"]["Tables"]["sports"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          sport_id: string;
          slug: string;
          name: string;
          sort_order: number;
          created_at: Timestamptz;
        };
        Insert: Omit<Database["public"]["Tables"]["categories"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: Timestamptz;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "categories_sport_id_fkey";
            columns: ["sport_id"];
            isOneToOne: false;
            referencedRelation: "sports";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          sort_order: number;
          created_at: Timestamptz;
        };
        Insert: Omit<Database["public"]["Tables"]["groups"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: Timestamptz;
        };
        Update: Partial<Database["public"]["Tables"]["groups"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "groups_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          id: string;
          category_id: string;
          group_id: string | null;
          name: string;
          university: string | null;
          created_at: Timestamptz;
        };
        Insert: Omit<Database["public"]["Tables"]["teams"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: Timestamptz;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "teams_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      venues: {
        Row: {
          id: string;
          slug: string;
          name: string;
          short_name: string;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          sort_order: number;
          created_at: Timestamptz;
        };
        Insert: Omit<Database["public"]["Tables"]["venues"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: Timestamptz;
        };
        Update: Partial<Database["public"]["Tables"]["venues"]["Insert"]>;
        Relationships: [];
      };
      courts: {
        Row: {
          id: string;
          venue_id: string;
          sport_id: string | null;
          name: string;
          sort_order: number;
          created_at: Timestamptz;
        };
        Insert: Omit<Database["public"]["Tables"]["courts"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: Timestamptz;
        };
        Update: Partial<Database["public"]["Tables"]["courts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "courts_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "courts_sport_id_fkey";
            columns: ["sport_id"];
            isOneToOne: false;
            referencedRelation: "sports";
            referencedColumns: ["id"];
          },
        ];
      };
      fixtures: {
        Row: {
          id: string;
          category_id: string;
          group_id: string | null;
          stage: FixtureStage;
          team_a_id: string | null;
          team_b_id: string | null;
          placeholder_a: string | null;
          placeholder_b: string | null;
          court_id: string | null;
          scheduled_time: Timestamptz;
          status: FixtureStatus;
          score_a: number | null;
          score_b: number | null;
          started_at: Timestamptz | null;
          finished_at: Timestamptz | null;
          delay_minutes: number;
          delay_notified_minutes: number;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: Omit<
          Database["public"]["Tables"]["fixtures"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "started_at"
          | "finished_at"
          | "delay_minutes"
          | "delay_notified_minutes"
        > & {
          id?: string;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
          started_at?: Timestamptz | null;
          finished_at?: Timestamptz | null;
          delay_minutes?: number;
          delay_notified_minutes?: number;
        };
        Update: Partial<Database["public"]["Tables"]["fixtures"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "fixtures_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fixtures_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fixtures_team_a_id_fkey";
            columns: ["team_a_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fixtures_team_b_id_fkey";
            columns: ["team_b_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fixtures_court_id_fkey";
            columns: ["court_id"];
            isOneToOne: false;
            referencedRelation: "courts";
            referencedColumns: ["id"];
          },
        ];
      };
      vendors: {
        Row: {
          id: string;
          venue_id: string;
          name: string;
          cuisine: string;
          location: string | null;
          photo_url: string | null;
          latitude: number | null;
          longitude: number | null;
          tagline: string | null;
          instagram: string | null;
          tags: string[];
          sort_order: number;
          created_at: Timestamptz;
        };
        Insert: Omit<
          Database["public"]["Tables"]["vendors"]["Row"],
          "id" | "created_at" | "tagline" | "instagram" | "tags"
        > & {
          id?: string;
          created_at?: Timestamptz;
          tagline?: string | null;
          instagram?: string | null;
          tags?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["vendors"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "vendors_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          id: string;
          vendor_id: string;
          name: string;
          price_pence: number;
          sort_order: number;
          created_at: Timestamptz;
        };
        Insert: Omit<Database["public"]["Tables"]["menu_items"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: Timestamptz;
        };
        Update: Partial<Database["public"]["Tables"]["menu_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "menu_items_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          endpoint: string;
          p256dh: string;
          auth: string;
          team_ids: string[];
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: Omit<
          Database["public"]["Tables"]["push_subscriptions"]["Row"],
          "created_at" | "updated_at" | "team_ids"
        > & { team_ids?: string[]; created_at?: Timestamptz; updated_at?: Timestamptz };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>;
        Relationships: [];
      };
      coordinators: {
        Row: {
          user_id: string;
          name: string;
          /** Null means a committee admin, allowed to edit every sport. */
          sport_id: string | null;
          created_at: Timestamptz;
        };
        Insert: Omit<Database["public"]["Tables"]["coordinators"]["Row"], "created_at"> & {
          created_at?: Timestamptz;
        };
        Update: Partial<Database["public"]["Tables"]["coordinators"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "coordinators_sport_id_fkey";
            columns: ["sport_id"];
            isOneToOne: false;
            referencedRelation: "sports";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          id: string;
          type: AnnouncementType;
          title: string;
          body: string | null;
          published_at: Timestamptz;
          created_at: Timestamptz;
        };
        Insert: Omit<
          Database["public"]["Tables"]["announcements"]["Row"],
          "id" | "created_at" | "published_at"
        > & { id?: string; created_at?: Timestamptz; published_at?: Timestamptz };
        Update: Partial<Database["public"]["Tables"]["announcements"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      register_push_subscription: {
        Args: {
          p_endpoint: string;
          p_p256dh: string;
          p_auth: string;
          p_team_ids: string[];
        };
        Returns: undefined;
      };
      unregister_push_subscription: {
        Args: { p_endpoint: string };
        Returns: undefined;
      };
    };
    Enums: {
      fixture_stage: FixtureStage;
      fixture_status: FixtureStatus;
      announcement_type: AnnouncementType;
    };
    CompositeTypes: Record<never, never>;
  };
}
