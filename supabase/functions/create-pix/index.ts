import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache do token de autenticação
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAuthToken(clientId: string, clientSecret: string): Promise<string> {
  // Verificar se o token em cache ainda é válido (com margem de 5 minutos)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return cachedToken.token;
  }

  console.log('Gerando novo token SyncPay...');
  
  const response = await fetch('https://api.syncpayments.com.br/api/partner/v1/auth-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Erro ao gerar token SyncPay:', errorData);
    throw new Error('Falha ao autenticar com SyncPay');
  }

  const data = await response.json();
  
  // Cachear o token (expires_in é em segundos)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { value, plan_name } = await req.json();

    if (!value || value < 50) {
      return new Response(
        JSON.stringify({ error: 'Valor mínimo é 50 centavos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId = Deno.env.get('SYNCPAY_CLIENT_ID');
    const clientSecret = Deno.env.get('SYNCPAY_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      console.error('Credenciais SyncPay não configuradas');
      return new Response(
        JSON.stringify({ error: 'API não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter token de autenticação
    const authToken = await getAuthToken(clientId, clientSecret);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const webhookUrl = `${supabaseUrl}/functions/v1/syncpay-webhook`;

    // Converter centavos para reais (SyncPay usa valor em reais)
    const amountInReais = value / 100;

    console.log(`Criando PIX SyncPay para plano: ${plan_name}, valor: R$ ${amountInReais.toFixed(2)}, webhook: ${webhookUrl}`);

    const response = await fetch('https://api.syncpayments.com.br/api/partner/v1/cash-in', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInReais,
        description: plan_name,
        webhook_url: webhookUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro na API SyncPay:', data);
      return new Response(
        JSON.stringify({ error: data.message || 'Erro ao gerar PIX' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('PIX criado com sucesso:', data.identifier);

    // Salvar transação no banco
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('pix_payments')
      .insert({
        transaction_id: data.identifier,
        plan_name: plan_name,
        value: value,
        status: 'pending',
      });

    // Gerar QR code base64 a partir do pix_code
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.pix_code)}`;

    return new Response(
      JSON.stringify({
        id: data.identifier,
        qr_code: data.pix_code,
        qr_code_base64: qrCodeUrl,
        status: 'pending',
        value: value,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao criar PIX:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar pagamento' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
