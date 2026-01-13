import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapear status do PushinPay para nosso formato
const mapPushinPayStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'approved': 'paid',
    'paid': 'paid',
    'completed': 'paid',
    'rejected': 'rejected',
    'cancelled': 'cancelled',
    'canceled': 'cancelled',
    'expired': 'expired',
    'refunded': 'refunded',
  };
  return statusMap[status.toLowerCase()] || status.toLowerCase();
};

// Mapear status para UTMify
const mapStatusToUtmify = (status: string): string | null => {
  const utmifyStatusMap: Record<string, string> = {
    'pending': 'waiting_payment',
    'paid': 'paid',
  };
  return utmifyStatusMap[status] || null;
};

// Enviar evento para UTMify
async function sendToUtmify(
  apiKey: string,
  transactionId: string,
  status: string,
  value: number,
  planName: string,
  trackingParams?: Record<string, string | null>
) {
  const utmifyStatus = mapStatusToUtmify(status);
  
  if (!utmifyStatus) {
    console.log('Status não mapeado para UTMify:', status);
    return;
  }

  try {
    const payload = {
      orderId: transactionId,
      platform: "custom",
      paymentMethod: "pix",
      status: utmifyStatus,
      createdAt: new Date().toISOString(),
      approvedDate: utmifyStatus === 'paid' ? new Date().toISOString() : null,
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
        src: trackingParams?.src || null,
        sck: trackingParams?.sck || null,
        utm_source: trackingParams?.utm_source || null,
        utm_campaign: trackingParams?.utm_campaign || null,
        utm_medium: trackingParams?.utm_medium || null,
        utm_content: trackingParams?.utm_content || null,
        utm_term: trackingParams?.utm_term || null,
      },
      isTest: false,
    };

    console.log('Enviando para UTMify:', JSON.stringify(payload));

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
      console.log('UTMify resposta:', JSON.stringify(result));
    }
  } catch (error) {
    console.error('Erro ao enviar para UTMify:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload = await req.json();
    
    console.log('Webhook PushinPay recebido:', JSON.stringify(payload));

    // PushinPay envia { id, status, ... }
    const transactionId = payload.id || payload.transaction_id;
    const rawStatus = payload.status;

    if (!transactionId || !rawStatus) {
      console.error('Payload inválido - faltando id ou status');
      return new Response(
        JSON.stringify({ error: 'Invalid payload structure' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const status = mapPushinPayStatus(rawStatus);

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se a transação existe e buscar dados completos incluindo tracking params
    const { data: existingPayment, error: fetchError } = await supabase
      .from('pix_payments')
      .select('id, status, value, plan_name, payload')
      .eq('transaction_id', transactionId)
      .single();

    if (fetchError || !existingPayment) {
      console.error('Transação não encontrada:', transactionId);
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevenir downgrade de status
    const statusPriority: Record<string, number> = {
      'pending': 1,
      'paid': 3,
      'rejected': 0,
      'cancelled': 0,
      'expired': 0,
      'refunded': 4
    };

    const currentPriority = statusPriority[existingPayment.status] || 0;
    const newPriority = statusPriority[status] || 0;

    if (newPriority < currentPriority && !['rejected', 'cancelled', 'expired', 'refunded'].includes(status)) {
      console.log('Ignorando downgrade de status:', existingPayment.status, '->', status);
      return new Response(
        JSON.stringify({ success: true, message: 'Status unchanged' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair tracking params ANTES de atualizar o payload
    const savedPayload = existingPayment.payload as Record<string, unknown> | null;
    const trackingParams = savedPayload?.tracking_params as Record<string, string | null> | undefined;
    
    console.log('Tracking params recuperados:', JSON.stringify(trackingParams || {}));

    // Atualizar status do pagamento - preservando tracking_params
    const { error } = await supabase
      .from('pix_payments')
      .update({
        status: status,
        payload: { ...payload, tracking_params: trackingParams || {} },
        updated_at: new Date().toISOString(),
      })
      .eq('transaction_id', transactionId);

    if (error) {
      console.error('Erro ao salvar status:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update payment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Status do pagamento atualizado:', transactionId, status);

    // Enviar para UTMify se configurado
    const utmifyApiKey = Deno.env.get('UTMIFY_API_KEY');
    if (utmifyApiKey) {
      await sendToUtmify(
        utmifyApiKey,
        transactionId,
        status,
        existingPayment.value,
        existingPayment.plan_name,
        trackingParams
      );
    } else {
      console.log('UTMIFY_API_KEY não configurado, pulando envio para UTMify');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
