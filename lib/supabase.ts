import { createClient } from "@supabase/supabase-js";

/**
 * The garden's Supabase project. Both values are public by design: the
 * publishable key can only do what the row-level security policies allow,
 * which is reading plants and adding new ones (never editing or deleting).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://hidqmcciuwffuiqqysig.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_fHRlKjVeAq7Y-mDsWXn3Cw_T8yFQjDJ";

export const MEDIA_BUCKET = "garden-media";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  // No logins: the passcode is the only gate, so there's no session to keep.
  auth: { persistSession: false, autoRefreshToken: false },
});
