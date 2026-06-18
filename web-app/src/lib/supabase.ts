import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const getPublicSupabaseConfig = () => {
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  }
  return { supabaseUrl, supabaseAnonKey };
};

let browserSupabaseClient: SupabaseClient | null = null;

const getBrowserSupabaseClient = () => {
  if (!browserSupabaseClient) {
    const config = getPublicSupabaseConfig();
    browserSupabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }
  return browserSupabaseClient;
};

// クライアントサイド/標準ユーザー用クライアント
// Next.js のビルド時 import では環境変数検証を遅延し、実際の Supabase 呼び出し時に明示的なエラーを出す。
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getBrowserSupabaseClient(), prop, receiver);
  },
});

// サーバーサイド・管理者操作用クライアント (RLSをバイパスし、全ユーザーのバッチ処理等を実行可能)
export const getSupabaseAdmin = () => {
  const config = getPublicSupabaseConfig();
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(config.supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
