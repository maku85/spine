// Hand-written to match supabase/migrations/*.sql until a real Supabase
// project is linked. Regenerate with:
//   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
export type ReadingStatus = "wishlist" | "to_read" | "reading" | "read";

export type Database = {
  public: {
    Tables: {
      books: {
        Row: {
          id: string;
          ol_work_key: string | null;
          ol_edition_key: string | null;
          isbn: string | null;
          title: string;
          authors: string[];
          description: string | null;
          subjects: string[];
          first_publish_year: number | null;
          nyt_review_url: string | null;
          nyt_review_summary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ol_work_key?: string | null;
          ol_edition_key?: string | null;
          isbn?: string | null;
          title: string;
          authors?: string[];
          description?: string | null;
          subjects?: string[];
          first_publish_year?: number | null;
          nyt_review_url?: string | null;
          nyt_review_summary?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["books"]["Insert"]>;
        Relationships: [];
      };
      user_books: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          status: ReadingStatus;
          rating: number | null;
          started_at: string | null;
          finished_at: string | null;
          notes: string | null;
          added_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          status?: ReadingStatus;
          rating?: number | null;
          started_at?: string | null;
          finished_at?: string | null;
          notes?: string | null;
          added_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_books"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "user_books_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      upsert_book_from_ol: {
        Args: {
          p_ol_work_key: string | null;
          p_ol_edition_key: string | null;
          p_isbn: string | null;
          p_title: string;
          p_authors: string[];
          p_description: string | null;
          p_subjects: string[];
          p_first_publish_year: number | null;
          p_nyt_review_url: string | null;
          p_nyt_review_summary: string | null;
        };
        Returns: Database["public"]["Tables"]["books"]["Row"];
      };
    };
    Enums: {
      reading_status: ReadingStatus;
    };
  };
};
