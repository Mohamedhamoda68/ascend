function getEnv(key, fallback) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {}
  return fallback;
}

export const config = {
  supabase: {
    url: getEnv('SUPABASE_URL', 'https://ydybwvukevvlehmqcsdo.supabase.co'),
    anonKey: getEnv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkeWJ3dnVrZXZ2bGVobXFjc2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MjY1NTUsImV4cCI6MjEwNjIwMjU1NX0.8B6qwhcegzNartz8Gw6yn3HV9p9uZDQyTFZyrxiyjx0')
  },
  site: {
    name: 'ASCEND',
    url: 'https://ascend-gules-two.vercel.app',
    description: 'منصة تعليمية متكاملة'
  }
}; 