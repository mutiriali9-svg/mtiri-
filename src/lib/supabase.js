import { createClient } from '@supabase/supabase-js';

// هذه المتغيرات سيقرأها المشروع من إعدادات Vercel أو من ملف .env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const createClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey);
};