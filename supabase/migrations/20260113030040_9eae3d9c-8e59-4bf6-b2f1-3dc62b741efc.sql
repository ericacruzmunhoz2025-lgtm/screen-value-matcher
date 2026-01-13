-- Remover TODAS as políticas existentes
DROP POLICY IF EXISTS "Select only for service role" ON public.pix_payments;
DROP POLICY IF EXISTS "Select allowed for service role" ON public.pix_payments;
DROP POLICY IF EXISTS "Insert only for service role" ON public.pix_payments;
DROP POLICY IF EXISTS "Insert allowed for service role" ON public.pix_payments;
DROP POLICY IF EXISTS "Update only for service role" ON public.pix_payments;
DROP POLICY IF EXISTS "Update allowed for service role" ON public.pix_payments;
DROP POLICY IF EXISTS "Delete only for service role" ON public.pix_payments;
DROP POLICY IF EXISTS "Delete allowed for service role" ON public.pix_payments;

-- Criar UMA ÚNICA política PERMISSIVA para service_role
CREATE POLICY "Service role full access"
ON public.pix_payments
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);