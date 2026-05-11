import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL?.trim()
  .replace(/\/$/, "")
  .replace(/\/rest\/v1$/, ""); // Remove /rest/v1 se o usuário colou a URL da API por engano
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY?.trim();

// Inicializa apenas se as chaves existirem
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!supabase) {
  console.warn('Configuração do Supabase ausente. Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
}
