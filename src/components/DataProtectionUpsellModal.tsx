import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, ShieldAlert, Loader2, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { trackPurchase, trackInitiateCheckout } from "@/lib/meta-pixel";
import { trackUtmifyPurchase } from "@/lib/utmify-pixel";

interface DataProtectionUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  onDecline: () => void;
}

const DataProtectionUpsellModal = ({ isOpen, onClose, onPaymentSuccess, onDecline }: DataProtectionUpsellModalProps) => {
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
    trackInitiateCheckout(1700, 'BRL', 'Proteção de Dados');

    try {
      const { data, error } = await supabase.functions.invoke('create-pix', {
        body: {
          value: 1700, // R$ 17,00 em centavos
          plan_name: 'Proteção de Dados',
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
          trackPurchase(1700, 'BRL', 'Proteção de Dados');
          trackUtmifyPurchase(1700, transactionId);
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
        {/* Red Alert Header */}
        <div className="relative bg-gradient-to-br from-red-600 to-red-700 px-5 py-6 text-center">
          <button 
            onClick={handleClose}
            className="absolute right-3 top-3 p-1.5 rounded-full bg-black/10 hover:bg-black/20 transition-colors"
            type="button"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <AlertTriangle className="w-8 h-8 text-yellow-300 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-wide mb-1">
            ⚠️ ATENÇÃO! ⚠️
          </h2>
          <p className="text-white/90 text-sm font-medium">
            Seu acesso pode ser CANCELADO!
          </p>
        </div>

        <div className="bg-gradient-to-b from-red-600 to-red-700 px-5 pb-6">
          {!pixData ? (
            <>
              {/* Warning Message */}
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 mb-4 border border-white/20">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-6 h-6 text-yellow-300 flex-shrink-0 mt-0.5" />
                  <div className="text-white text-sm leading-relaxed">
                    <p className="font-bold mb-2">Sem proteção de dados, você fica vulnerável a:</p>
                    <ul className="space-y-1 text-white/90">
                      <li>❌ Vazamento do seu acesso</li>
                      <li>❌ Bloqueio permanente da conta</li>
                      <li>❌ Perda de todo conteúdo comprado</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Price Box */}
              <div className="bg-white rounded-2xl py-4 px-6 text-center mb-4">
                <p className="text-sm text-muted-foreground line-through mb-1">De R$ 49,90</p>
                <p className="text-3xl font-black text-red-600">
                  R$ 17,00
                </p>
                <p className="text-xs text-green-600 font-semibold mt-1">🔥 66% OFF - OFERTA ÚNICA!</p>
              </div>

              {/* CTA Button */}
              <button
                onClick={handleCTA}
                disabled={isLoading}
                className="w-full py-4 rounded-xl font-black bg-yellow-400 text-black hover:bg-yellow-300 transition-all disabled:opacity-50 uppercase tracking-wide text-lg shadow-lg animate-pulse"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  "🛡️ PROTEGER AGORA!"
                )}
              </button>

              {/* Decline Link */}
              <button
                onClick={onDecline}
                className="w-full mt-3 text-white/60 text-xs underline hover:text-white/80 transition-colors"
              >
                Não quero proteção (assumir riscos)
              </button>
            </>
          ) : (
            <>
              {/* PIX Payment View */}
              <div className="bg-white rounded-2xl p-4 mb-4">
                <div className="text-center mb-3">
                  <p className="text-lg font-bold text-foreground">R$ 17,00</p>
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
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-red-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={handleCopyCode}
                className={`w-full py-4 rounded-xl font-bold transition-colors uppercase tracking-wide ${
                  copied 
                    ? 'bg-green-500 text-white' 
                    : 'bg-yellow-400 text-black hover:bg-yellow-300'
                }`}
              >
                {copied ? "✓ Código copiado!" : "Copiar código PIX"}
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

export default DataProtectionUpsellModal;
