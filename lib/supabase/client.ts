// FILE LOCATION: src/lib/supabase/client.ts
//
// Creates the Supabase connection used by code running in the
// BROWSER. It reads the two values from .env.local.
//
// This is safe to use in the browser because the publishable key
// only grants what your RLS policies allow.

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
