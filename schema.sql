-- SQL ROBUSTO PARA SUPABASE
-- Execute este comando no SQL Editor do seu projeto Supabase

-- 1. Criar a tabela se não existir
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    student_name TEXT NOT NULL,
    student_class TEXT NOT NULL,
    content TEXT NOT NULL
);

-- 2. Garantir que o RLS está ativado
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 3. Recriar Políticas de Acesso
DO $$ 
BEGIN
    -- Remove políticas se existirem para evitar conflitos
    DROP POLICY IF EXISTS "Permitir leitura pública de relatórios" ON public.reports;
    DROP POLICY IF EXISTS "Permitir inserção pública de relatórios" ON public.reports;
    DROP POLICY IF EXISTS "Permitir exclusão pública de relatórios" ON public.reports;
    
    -- Criação das novas políticas
    CREATE POLICY "Permitir leitura pública de relatórios" ON public.reports FOR SELECT USING (true);
    CREATE POLICY "Permitir inserção pública de relatórios" ON public.reports FOR INSERT WITH CHECK (true);
    CREATE POLICY "Permitir exclusão pública de relatórios" ON public.reports FOR DELETE USING (true);
END $$;
