-- SQL para criar a tabela de relatórios no Supabase
-- Execute este comando no SQL Editor do seu projeto Supabase

-- 1. Criar a tabela
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    student_name TEXT NOT NULL,
    student_class TEXT NOT NULL,
    content TEXT NOT NULL
);

-- 2. Ativar Row Level Security (RLS)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas de Acesso
-- Remove políticas existentes para evitar erros de duplicidade
DROP POLICY IF EXISTS "Permitir leitura pública de relatórios" ON public.reports;
DROP POLICY IF EXISTS "Permitir inserção pública de relatórios" ON public.reports;
DROP POLICY IF EXISTS "Permitir exclusão pública de relatórios" ON public.reports;

-- Política para Leitura (Select)
CREATE POLICY "Permitir leitura pública de relatórios" 
ON public.reports FOR SELECT 
USING (true);

-- Política para Inserção (Insert)
CREATE POLICY "Permitir inserção pública de relatórios" 
ON public.reports FOR INSERT 
WITH CHECK (true);

-- Política para Exclusão (Delete)
CREATE POLICY "Permitir exclusão pública de relatórios" 
ON public.reports FOR DELETE 
USING (true);
