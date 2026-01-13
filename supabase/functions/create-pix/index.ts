import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const apiKey = Deno.env.get('PUSHINPAY_API_KEY');
    
    if (!apiKey) {
      console.error('PUSHINPAY_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'API não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const webhookUrl = `${supabaseUrl}/functions/v1/pushinpay-webhook`;

    console.log(`Criando PIX PushinPay para plano: ${plan_name}, valor: ${value} centavos`);

    // PushinPay usa valor em centavos
    const response = await fetch('https://api.pushinpay.com.br/api/pix/cashIn', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: value,
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

    const transactionId = data.id;
    const qrCode = data.qr_code;
    const qrCodeBase64 = data.qr_code_base64;

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
    if (!qrCodeUrl) {
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
