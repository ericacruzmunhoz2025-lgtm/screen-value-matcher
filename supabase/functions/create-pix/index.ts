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

interface TrackingParams {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  src?: string | null;
  sck?: string | null;
}

// URLs da API SyncPay - tentar múltiplas opções
const SYNCPAY_API_URLS = [
  'https://app.syncpayments.com.br',
  'https://api.syncpayments.com.br', 
  'https://gateway.syncpay.io',
  'https://api.syncpay.io',
];

// Obter token de autenticação do SyncPay
async function getSyncPayToken(clientId: string, clientSecret: string): Promise<{ token: string | null; baseUrl: string | null }> {
  for (const baseUrl of SYNCPAY_API_URLS) {
    try {
      console.log(`Tentando autenticar em ${baseUrl}...`);
      
      const response = await fetch(`${baseUrl}/api/partner/v1/auth-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const token = data.access_token || data.token || data.bearer_token;
        if (token) {
          console.log(`Token obtido com sucesso de ${baseUrl}`);
          return { token, baseUrl };
        }
      }
      
      const errorData = await response.text();
      console.log(`Falha em ${baseUrl}: ${response.status} - ${errorData}`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.log(`Erro de conexão em ${baseUrl}:`, errMsg);
    }
  }
  
  console.error('Falha ao obter token em todas as URLs');
  return { token: null, baseUrl: null };
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
  const corsHeaders = getCorsHeaders(req);
  
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

    const clientId = Deno.env.get('SYNCPAY_PUBLIC_KEY');
    const clientSecret = Deno.env.get('SYNCPAY_SECRET_KEY');
    
    if (!clientId || !clientSecret) {
      console.error('SYNCPAY keys não configuradas');
      return new Response(
        JSON.stringify({ error: 'API não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Criando PIX SyncPay para plano: ${plan_name}, valor: ${value} centavos`);
    console.log('Tracking params recebidos:', JSON.stringify(tracking_params || {}));

    // Obter token de autenticação
    const { token, baseUrl } = await getSyncPayToken(clientId, clientSecret);
    
    if (!token || !baseUrl) {
      console.error('Falha ao obter token SyncPay em todas as URLs');
      return new Response(
        JSON.stringify({ error: 'Erro de autenticação com gateway de pagamento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const webhookUrl = `${supabaseUrl}/functions/v1/syncpay-webhook`;

    // Criar PIX via endpoint CashIn
    const response = await fetch(`${baseUrl}/v1/gateway/api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        pix: {
          value: (value / 100).toFixed(2),
          description: plan_name || 'Pagamento PIX',
        },
        items: [
          {
            name: plan_name || 'Assinatura',
            quantity: 1,
            value: (value / 100).toFixed(2),
          }
        ],
        urlWebHook: webhookUrl,
        client_id: clientId,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.status === 'error') {
      console.error('Erro na API SyncPay CashIn:', data);
      return new Response(
        JSON.stringify({ error: data.message || data.error || 'Erro ao gerar PIX' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Resposta SyncPay:', JSON.stringify(data));

    // SyncPay pode retornar em diferentes formatos
    const transactionId = data.idTransaction || data.id || data.transaction_id || data.txid;
    const qrCode = data.paymentCode || data.qr_code || data.pix_code || data.emv;
    const qrCodeBase64Raw = data.paymentCodeBase64 || data.qr_code_base64 || data.qr_code_image;

    if (!transactionId) {
      console.error('SyncPay não retornou transaction ID:', data);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar resposta do gateway' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        payload: { tracking_params: tracking_params || {}, provider: 'syncpay' },
      });

    // Enviar pedido pendente para UTMify
    const utmifyApiKey = Deno.env.get('UTMIFY_API_KEY');
    if (utmifyApiKey) {
      await sendPendingOrderToUtmify(utmifyApiKey, transactionId, value, plan_name, tracking_params || {});
    } else {
      console.log('UTMIFY_API_KEY não configurado, pulando envio para UTMify');
    }

    // Gerar QR code URL
    let qrCodeUrl = '';
    if (qrCodeBase64Raw) {
      if (qrCodeBase64Raw.startsWith('data:') || qrCodeBase64Raw.startsWith('http')) {
        qrCodeUrl = qrCodeBase64Raw;
      } else {
        try {
          const decodedEMV = atob(qrCodeBase64Raw);
          qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(decodedEMV)}`;
        } catch {
          qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode || '')}`;
        }
      }
    } else if (qrCode) {
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
