-- Remover política existente
DROP POLICY IF EXISTS "Only service role can access" ON public.pix_payments;

-- Abordagem diferente: Criar política que nega tudo para anon e authenticated
-- e permite apenas para service_role

-- Política para SELECT - só service_role
CREATE POLICY "Select only for service role"
ON public.pix_payments
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (false);

CREATE POLICY "Select allowed for service role"
ON public.pix_payments
AS PERMISSIVE
FOR SELECT
TO service_role
USING (true);

-- Política para INSERT - só service_role
CREATE POLICY "Insert only for service role"
ON public.pix_payments
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Insert allowed for service role"
ON public.pix_payments
AS PERMISSIVE
FOR INSERT
TO service_role
WITH CHECK (true);

-- Política para UPDATE - só service_role
CREATE POLICY "Update only for service role"
ON public.pix_payments
AS PERMISSIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Update allowed for service role"
ON public.pix_payments
AS PERMISSIVE
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Política para DELETE - só service_role
CREATE POLICY "Delete only for service role"
ON public.pix_payments
AS PERMISSIVE
FOR DELETE
TO anon, authenticated
USING (false);

CREATE POLICY "Delete allowed for service role"
ON public.pix_payments
AS PERMISSIVE
FOR DELETE
TO service_role
USING (true);