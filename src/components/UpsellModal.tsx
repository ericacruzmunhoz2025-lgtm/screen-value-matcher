import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Shield, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { trackPurchase, trackInitiateCheckout } from "@/lib/meta-pixel";
import { trackUtmifyPurchase } from "@/lib/utmify-pixel";

interface UpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

const UpsellModal = ({ isOpen, onClose, onPaymentSuccess }: UpsellModalProps) => {
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
    trackInitiateCheckout(1100, 'BRL', 'Proteja seus dados');

    try {
      const { data, error } = await supabase.functions.invoke('create-pix', {
        body: {
          value: 1100, // R$ 11,00 em centavos
          plan_name: 'Proteja seus dados',
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setPixData({
        transactionId: data.id,
        qrCode: data.qr_code,
        qrCodeBase64: data.qr_code_base64,
      });

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
    const maxAttempts = 60;

    const pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const { data, error } = await supabase.functions.invoke('check-pix-status', {
          body: { transaction_id: transactionId },
        });

        if (data?.status === 'approved' || data?.status === 'paid') {
          clearInterval(pollInterval);
          setIsPolling(false);
          trackPurchase(1100, 'BRL', 'Proteja seus dados');
          trackUtmifyPurchase(1100, transactionId);
          toast({
            title: "Pagamento confirmado!",
            description: "Seus dados estão protegidos",
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
      <DialogContent className="sm:max-w-sm p-0 border-none rounded-2xl overflow-hidden">
        {/* Pink Header */}
        <div className="relative bg-accent px-5 py-8 text-center">
          <button 
            onClick={handleClose}
            className="absolute right-3 top-3 p-1.5 rounded-full bg-black/10 hover:bg-black/20 transition-colors"
            type="button"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          
          <Shield className="w-10 h-10 text-white mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-white leading-tight">
            PROTEJA<br />SEUS DADOS
          </h2>
        </div>

        <div className="bg-accent px-5 pb-6">
          {!pixData ? (
            <>
              {/* Price Box */}
              <div className="bg-white rounded-2xl py-4 px-6 text-center mb-4">
                <p className="text-3xl font-bold text-foreground">
                  R$ 11,00
                </p>
              </div>

              {/* CTA Button */}
              <button
                onClick={handleCTA}
                disabled={isLoading}
                className="w-full py-4 rounded-xl font-bold bg-white text-accent hover:bg-gray-100 transition-colors disabled:opacity-50 uppercase tracking-wide"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-accent" />
                ) : (
                  "Liberação imediata"
                )}
              </button>
            </>
          ) : (
            <>
              {/* PIX Payment View */}
              <div className="bg-white rounded-2xl p-4 mb-4">
                <div className="text-center mb-3">
                  <p className="text-lg font-bold text-foreground">R$ 11,00</p>
                  <p className="text-xs text-muted-foreground">
                    {isPolling && "Aguardando pagamento..."}
                  </p>
                </div>

                {/* QR Code */}
                <div className="flex justify-center mb-3">
                  <img 
                    src={pixData.qrCodeBase64} 
                    alt="QR Code PIX" 
                    className="w-36 h-36"
                  />
                </div>

                {/* PIX Code */}
                <div className="relative bg-muted rounded-lg p-2">
                  <p className="text-[10px] font-mono break-all pr-6 max-h-12 overflow-y-auto text-foreground">
                    {pixData.qrCode}
                  </p>
                  <button
                    onClick={handleCopyCode}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-accent" />
                    )}
                  </button>
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={handleCopyCode}
                className={`w-full py-4 rounded-xl font-bold transition-colors uppercase tracking-wide ${
                  copied 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-white text-accent hover:bg-gray-100'
                }`}
              >
                {copied ? "Código copiado!" : "Copiar código PIX"}
              </button>

              <p className="text-[10px] text-white/80 text-center mt-3">
                O pagamento é confirmado automaticamente
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpsellModal;