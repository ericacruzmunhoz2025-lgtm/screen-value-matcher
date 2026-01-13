-- Remover política existente
DROP POLICY IF EXISTS "Only service role can access pix_payments" ON public.pix_payments;

-- Criar política PERMISSIVA que só permite service_role
-- Políticas permissivas são avaliadas com OR, então se nenhuma passar, acesso negado
CREATE POLICY "Service role full access"
ON public.pix_payments
FOR ALL
TO authenticated, anon, service_role
USING (
  (SELECT auth.role()) = 'service_role'
)
WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);