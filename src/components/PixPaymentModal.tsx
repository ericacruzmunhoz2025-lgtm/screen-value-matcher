import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Copy, CheckCircle2, Loader2, X, QrCode } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  value: number;
  transactionId: string;
  qrCodeBase64: string;
  qrCode: string;
  isLoading: boolean;
}

const PixPaymentModal = ({ 
  isOpen, 
  onClose, 
  planName, 
  value, 
  transactionId,
  qrCodeBase64, 
  qrCode,
  isLoading
}: PixPaymentModalProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
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

  const formatValue = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-0 bg-gradient-to-b from-card to-background border-none rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-accent/90 to-primary/80 px-6 py-5 text-center">
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 p-1 rounded-full bg-primary-foreground/15 hover:bg-primary-foreground/25 transition-colors"
            type="button"
          >
            <X className="w-4 h-4 text-primary-foreground" />
          </button>
          
          <div className="flex items-center justify-center gap-2 mb-1">
            <QrCode className="w-5 h-5 text-primary-foreground" />
            <h2 className="text-lg font-bold text-primary-foreground">Pagamento PIX</h2>
          </div>
          <p className="text-primary-foreground/80 text-sm">{planName}</p>
        </div>

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-muted" />
                <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin" />
              </div>
              <p className="text-muted-foreground mt-4 text-sm">Gerando QR Code...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-5">
              {/* Value */}
              <div className="text-center space-y-1">
                <p className="text-3xl font-bold text-foreground">{formatValue(value)}</p>
                {!!transactionId && (
                  <p className="text-[11px] text-muted-foreground">ID: {transactionId}</p>
                )}
              </div>

              {/* QR Code */}
              <div className="relative p-3 bg-card rounded-2xl shadow-lg border border-border">
                <img 
                  src={qrCodeBase64} 
                  alt="QR Code PIX" 
                  className="w-44 h-44 rounded-lg"
                />
              </div>

              {/* PIX Code Display */}
              <div className="w-full">
                <p className="text-xs text-muted-foreground text-center mb-2">Código PIX Copia e Cola</p>
                <div className="relative bg-muted/50 rounded-xl p-3 border border-border">
                  <p className="text-xs text-foreground font-mono break-all leading-relaxed pr-8 max-h-24 overflow-y-auto">
                    {qrCode}
                  </p>
                  <button
                    onClick={handleCopyCode}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors"
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
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold transition-all duration-200 ${
                  copied 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-gradient-to-r from-accent to-primary text-primary-foreground hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Código Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copiar Código PIX
                  </>
                )}
              </button>

              {/* Instructions */}
              <div className="text-center space-y-1 pb-2">
                <p className="text-xs text-muted-foreground">
                  Escaneie o QR Code ou copie o código acima
                </p>
                <p className="text-xs text-muted-foreground">
                  O pagamento é confirmado automaticamente ✓
                </p>
              </div>

            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PixPaymentModal;
