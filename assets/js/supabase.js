// ============================================
// ASCEND · Supabase Client (v2 - latest)
// ============================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm';
import { config } from './config.js';

export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);