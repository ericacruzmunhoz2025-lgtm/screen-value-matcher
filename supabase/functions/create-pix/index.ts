import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackingParams {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  src?: string | null;
  sck?: string | null;
}

// Enviar pedido pendente para UTMify
async function sendPendingOrderToUtmify(
  apiKey: string,
  transactionId: string,
  value: number,
  planName: string,
  trackingParams: TrackingParams
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
        src: trackingParams.src || null,
        sck: trackingParams.sck || null,
        utm_source: trackingParams.utm_source || null,
        utm_campaign: trackingParams.utm_campaign || null,
        utm_medium: trackingParams.utm_medium || null,
        utm_content: trackingParams.utm_content || null,
        utm_term: trackingParams.utm_term || null,
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
    const { value, plan_name, tracking_params } = await req.json();

    if (!value || value < 100) {
      return new Response(
        JSON.stringify({ error: 'Valor mínimo é R$ 1,00' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('PUSHINPAY_API_KEY');
    
    if (!apiKey) {
      console.error('PUSHINPAY_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'API não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Criando PIX PushinPay para plano: ${plan_name}, valor: ${value} centavos`);
    console.log('Tracking params recebidos:', JSON.stringify(tracking_params || {}));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const webhookUrl = `${supabaseUrl}/functions/v1/pushinpay-webhook`;

    // PushinPay usa valor em centavos (string)
    const response = await fetch('https://api.pushinpay.com.br/api/pix/cashIn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        value: value.toString(),
        webhook_url: webhookUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro na API PushinPay:', data);
      return new Response(
        JSON.stringify({ error: data.message || 'Erro ao gerar PIX' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Resposta PushinPay:', JSON.stringify(data));

    const transactionId = data.id;
    const qrCode = data.qr_code;
    const qrCodeBase64 = data.qr_code_base64;

    console.log('PIX criado com sucesso:', transactionId);

    // Salvar transação no banco com tracking params
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('pix_payments')
      .insert({
        transaction_id: transactionId,
        plan_name: plan_name,
        value: value,
        status: 'pending',
        payload: { tracking_params: tracking_params || {} },
      });

    // Enviar pedido pendente para UTMify
    const utmifyApiKey = Deno.env.get('UTMIFY_API_KEY');
    if (utmifyApiKey) {
      await sendPendingOrderToUtmify(utmifyApiKey, transactionId, value, plan_name, tracking_params || {});
    } else {
      console.log('UTMIFY_API_KEY não configurado, pulando envio para UTMify');
    }

    // Gerar QR code URL
    let qrCodeUrl = qrCodeBase64;
    if (qrCodeBase64 && !qrCodeBase64.startsWith('http') && !qrCodeBase64.startsWith('data:')) {
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
