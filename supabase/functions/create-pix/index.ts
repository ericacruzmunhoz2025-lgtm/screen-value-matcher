import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Obter token de autenticação SyncPay
async function getSyncPayToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
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
      const errorText = await response.text();
      console.error('Erro ao obter token SyncPay:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.token || data.access_token || data.bearer_token;
  } catch (error) {
    console.error('Erro ao obter token SyncPay:', error);
    return null;
  }
}

// Enviar pedido pendente para UTMify
async function sendPendingOrderToUtmify(
  apiKey: string,
  transactionId: string,
  value: number,
  planName: string
) {
  try {
    const payload = {
      orderId: transactionId,
      platform: "custom",
      paymentMethod: "pix",
      status: "waiting_payment",
      createdAt: new Date().toISOString(),
      approvedDate: null,
      refundedAt: null,
      customer: {
        name: "Cliente PIX",
        email: "cliente@pix.com",
        phone: null,
        document: null,
        country: "BR",
      },
      products: [
        {
          id: planName.replace(/\s+/g, '-').toLowerCase(),
          name: planName,
          planId: null,
          planName: null,
          quantity: 1,
          priceInCents: value,
        },
      ],
      commission: {
        totalPriceInCents: value,
        gatewayFeeInCents: 0,
        userCommissionInCents: value,
      },
      trackingParameters: {
        src: null,
        sck: null,
        utm_source: null,
        utm_campaign: null,
        utm_medium: null,
        utm_content: null,
        utm_term: null,
      },
      isTest: false,
    };

    console.log('Enviando pedido pendente para UTMify:', JSON.stringify(payload));

    const response = await fetch('https://api.utmify.com.br/api-credentials/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao enviar para UTMify:', response.status, errorText);
    } else {
      const result = await response.json();
      console.log('UTMify pedido pendente criado:', JSON.stringify(result));
    }
  } catch (error) {
    console.error('Erro ao enviar para UTMify:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { value, plan_name } = await req.json();

    if (!value || value < 100) {
      return new Response(
        JSON.stringify({ error: 'Valor mínimo é R$ 1,00' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId = Deno.env.get('SYNCPAY_CLIENT_ID');
    const clientSecret = Deno.env.get('SYNCPAY_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      console.error('SyncPay credentials não configuradas');
      return new Response(
        JSON.stringify({ error: 'API não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Criando PIX SyncPay para plano: ${plan_name}, valor: ${value} centavos`);

    // Obter token de autenticação
    const token = await getSyncPayToken(clientId, clientSecret);
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Falha na autenticação com SyncPay' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Token SyncPay obtido com sucesso');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const webhookUrl = `${supabaseUrl}/functions/v1/syncpay-webhook`;

    // SyncPay usa valor em reais (float)
    const valueInReais = value / 100;

    // Criar PIX usando o endpoint v1/gateway/api
    const response = await fetch('https://api.syncpayments.com.br/v1/gateway/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        ip: "127.0.0.1",
        pix: {
          expiresInDays: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
        items: [
          {
            title: plan_name,
            quantity: 1,
            tangible: false,
            unitPrice: valueInReais,
          },
        ],
        amount: valueInReais,
        customer: {
          cpf: "00000000000",
          name: "Cliente PIX",
          email: "cliente@pix.com",
          phone: "11999999999",
          externaRef: `${plan_name}-${Date.now()}`,
        },
        traceable: true,
        postbackUrl: webhookUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.status === 'error') {
      console.error('Erro na API SyncPay:', data);
      return new Response(
        JSON.stringify({ error: data.message || 'Erro ao gerar PIX' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Resposta SyncPay:', JSON.stringify(data));

    const transactionId = data.idTransaction || data.transaction_id || data.id;
    const qrCode = data.paymentCode || data.qr_code || data.pix_copia_cola;
    const qrCodeBase64 = data.paymentCodeBase64;

    console.log('PIX criado com sucesso:', transactionId);

    // Salvar transação no banco
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('pix_payments')
      .insert({
        transaction_id: transactionId,
        plan_name: plan_name,
        value: value,
        status: 'pending',
      });

    // Enviar pedido pendente para UTMify
    const utmifyApiKey = Deno.env.get('UTMIFY_API_KEY');
    if (utmifyApiKey) {
      await sendPendingOrderToUtmify(utmifyApiKey, transactionId, value, plan_name);
    } else {
      console.log('UTMIFY_API_KEY não configurado, pulando envio para UTMify');
    }

    // Gerar QR code URL se não vier base64
    let qrCodeUrl = qrCodeBase64;
    if (qrCodeBase64 && !qrCodeBase64.startsWith('http') && !qrCodeBase64.startsWith('data:')) {
      // É base64 puro, converter para data URL
      qrCodeUrl = `data:image/png;base64,${qrCodeBase64}`;
    } else if (!qrCodeUrl && qrCode) {
      qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`;
    }

    return new Response(
      JSON.stringify({
        id: transactionId,
        qr_code: qrCode,
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