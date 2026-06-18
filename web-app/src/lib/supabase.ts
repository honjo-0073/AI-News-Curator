import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const missingPublicSupabaseEnv = !supabaseUrl || !supabaseAnonKey;

if (missingPublicSupabaseEnv) {
  console.warn(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Supabase client calls will fail until these environment variables are configured.'
  );
}

// クライアントサイド/標準ユーザー用クライアント
// ビルド時に環境変数が未設定でも API Route の収集処理で import できるよう、
// 未設定時だけダミー値で初期化する。実運用では必ず Vercel に正しい値を設定すること。
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

// サーバーサイド・管理者操作用クライアント (RLSをバイパスし、全ユーザーのバッチ処理等を実行可能)
export const getSupabaseAdmin = () => {
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
