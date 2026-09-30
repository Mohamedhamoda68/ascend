// ============================================
// ASCEND · Supabase Client
// Created by Mohamed Hamouda
// ============================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm';
import { config } from './config.js';

if (!config.supabase.url || config.supabase.url.includes('YOUR-PROJECT')) {
  throw new Error('⚠️ يجب تحديث assets/js/config.js بمفاتيح Supabase');
}

export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);