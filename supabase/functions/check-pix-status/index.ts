import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Lista de origens permitidas
const getAllowedOrigins = (): string[] => {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
  const defaultOrigins = [
    'https://lovable.dev',
    'https://lovable.app',
  ];
  
  if (envOrigins) {
    return [...defaultOrigins, ...envOrigins.split(',').map(o => o.trim())];
  }
  
  // Em desenvolvimento/preview, permitir localhost e subdomínios lovable
  return [
    ...defaultOrigins,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
  ];
};

const getCorsHeaders = (req: Request): Record<string, string> => {
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = getAllowedOrigins();
  
  // Verificar se a origem é permitida ou é um subdomínio lovable
  const isAllowed = allowedOrigins.includes(origin) || 
    origin.endsWith('.lovable.app') || 
    origin.endsWith('.lovable.dev') ||
    origin.endsWith('.lovableproject.com');
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transaction_id } = await req.json();

    if (!transaction_id) {
      return new Response(
        JSON.stringify({ error: 'Transaction ID é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar status no banco de dados (atualizado pelo webhook)
    const { data, error } = await supabase
      .from('pix_payments')
      .select('status, updated_at')
      .eq('transaction_id', transaction_id)
      .maybeSingle();

    if (error) {
      console.error('Error checking payment status:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const status = data?.status || 'pending';
    console.log('PIX status from DB:', transaction_id, status);

    return new Response(
      JSON.stringify({
        id: transaction_id,
        status: status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking PIX status:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao verificar pagamento' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
