-- Remover política existente
DROP POLICY IF EXISTS "Service role full access" ON public.pix_payments;

-- Criar política PERMISSIVA que só permite service_role
-- Como é a única política PERMISSIVA, se não passar, acesso é negado
CREATE POLICY "Only service role can access"
ON public.pix_payments
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');