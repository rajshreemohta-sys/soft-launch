import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side only. Uses the service role key, which must never reach the browser.
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type Account = {
  id: string;
  company_name: string;
  search_terms: string[];
  sector: string;
  deal_stage: string | null;
  arjun_notes: string | null;
  last_contact_date: string | null;
  relationship_read: string | null;
  signal_score: number;
  latest_signal_type: string | null;
  latest_signal_summary: string | null;
  latest_signal_date: string | null;
  latest_signal_url: string | null;
  outreach_angle: string | null;
  hot_rank: number | null;
  last_checked_at: string | null;
};
