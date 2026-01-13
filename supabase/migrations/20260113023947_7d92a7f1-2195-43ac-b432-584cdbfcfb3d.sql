-- Remover políticas existentes
DROP POLICY IF EXISTS "Allow service role to manage pix_payments" ON public.pix_payments;
DROP POLICY IF EXISTS "Deny anonymous read access" ON public.pix_payments;

-- Criar política permissiva que bloqueia acesso anônimo (sem auth)
-- Como não temos autenticação de usuários, apenas o service_role deve acessar
-- Usando auth.role() para verificar se é service_role
CREATE POLICY "Only service role can access pix_payments"
ON public.pix_payments
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');