import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Lock, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { trackPurchase, trackInitiateCheckout } from "@/lib/meta-pixel";
import { trackUtmifyPurchase } from "@/lib/utmify-pixel";

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

const WhatsAppModal = ({ isOpen, onClose, onPaymentSuccess }: WhatsAppModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pixData, setPixData] = useState<{
    transactionId: string;
    qrCode: string;
    qrCodeBase64: string;
  } | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const handleCTA = async () => {
    setIsLoading(true);
    setPixData(null);
    trackInitiateCheckout(1490, 'BRL', 'Acesso Privado');

    try {
      const { data, error } = await supabase.functions.invoke('create-pix', {
        body: {
          value: 1490, // R$ 14,90 em centavos
          plan_name: 'Acesso Privado',
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setPixData({
        transactionId: data.id,
        qrCode: data.qr_code,
        qrCodeBase64: data.qr_code_base64,
      });

      // Start polling for payment status
      startPolling(data.id);
    } catch (error) {
      console.error('Error creating PIX:', error);
      toast({
        title: "Erro ao gerar PIX",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = (transactionId: string) => {
    setIsPolling(true);
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos (5s * 60)

    const pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const { data, error } = await supabase.functions.invoke('check-pix-status', {
          body: { transaction_id: transactionId },
        });

        if (data?.status === 'approved' || data?.status === 'paid') {
          clearInterval(pollInterval);
          setIsPolling(false);
          trackPurchase(1490, 'BRL', 'Acesso Privado');
          trackUtmifyPurchase(1490, transactionId);
          toast({
            title: "Pagamento confirmado!",
            description: "Seu acesso foi liberado",
          });
          onPaymentSuccess();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }

      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        setIsPolling(false);
      }
    }, 5000);
  };

  const handleCopyCode = async () => {
    if (!pixData?.qrCode) return;
    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      setCopied(true);
      toast({
        title: "Código copiado!",
        description: "Cole no seu app de pagamentos",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setPixData(null);
    setIsPolling(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 bg-card border border-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-accent px-5 py-4">
          <button 
            onClick={handleClose}
            className="absolute right-3 top-3 p-1.5 rounded-full bg-black/10 hover:bg-black/20 transition-colors"
            type="button"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-white" />
            <h2 className="text-base font-semibold text-white">Acesso Privado</h2>
          </div>
        </div>

        <div className="px-5 py-5">
          {!pixData ? (
            <>
              {/* Benefits List */}
              <ul className="space-y-2.5 mb-5 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="text-foreground">Conversa direta</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="text-foreground">Áudios personalizados</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="text-foreground">Fotos/vídeos exclusivos</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="text-foreground">Chamada de vídeo</span>
                </li>
              </ul>

              {/* Pricing */}
              <div className="text-center mb-5">
                <p className="text-xs text-muted-foreground line-through">
                  Normalmente cobro R$97
                </p>
                <p className="text-xl font-bold text-foreground mt-1">
                  Hoje por <span className="text-accent">R$14,90</span>
                </p>
              </div>

              {/* CTA Button */}
              <button
                onClick={handleCTA}
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-semibold bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  "Liberar acesso privado"
                )}
              </button>
            </>
          ) : (
            <>
              {/* PIX Payment View */}
              <div className="text-center mb-4">
                <p className="text-lg font-bold text-foreground">R$ 14,90</p>
                <p className="text-xs text-muted-foreground">
                  {isPolling && "Aguardando pagamento..."}
                </p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center mb-4">
                <div className="p-2 bg-white rounded-lg">
                  <img 
                    src={pixData.qrCodeBase64} 
                    alt="QR Code PIX" 
                    className="w-40 h-40"
                  />
                </div>
              </div>

              {/* PIX Code */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground text-center mb-2">Código PIX</p>
                <div className="relative bg-muted rounded-lg p-3">
                  <p className="text-xs font-mono break-all pr-8 max-h-16 overflow-y-auto text-foreground">
                    {pixData.qrCode}
                  </p>
                  <button
                    onClick={handleCopyCode}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-accent/10 hover:bg-accent/20"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                    ) : (
                      <Copy className="w-4 h-4 text-accent" />
                    )}
                  </button>
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={handleCopyCode}
                className={`w-full py-3.5 rounded-xl font-semibold transition-colors ${
                  copied 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-accent text-white hover:bg-accent/90'
                }`}
              >
                {copied ? "Código copiado!" : "Copiar código PIX"}
              </button>

              <p className="text-[10px] text-muted-foreground text-center mt-3">
                O pagamento é confirmado automaticamente
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppModal;