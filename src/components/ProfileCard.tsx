import { Image, Film, Lock, Heart, Instagram, BadgeCheck } from "lucide-react";
import { useState, type SVGProps } from "react";
import profileImage from "@/assets/profile.jpg";
import coverImage from "@/assets/cover.jpg";
import WhatsAppModal from "./WhatsAppModal";
import UpsellModal from "./UpsellModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import PixPaymentModal from "./PixPaymentModal";
import DataProtectionUpsellModal from "./DataProtectionUpsellModal";
import ContentReleaseUpsellModal from "./ContentReleaseUpsellModal";
import { trackPurchase, trackInitiateCheckout } from "@/lib/meta-pixel";
import { trackUtmifyPurchase } from "@/lib/utmify-pixel";

const WhatsAppIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M19.11 17.23c-.26-.13-1.52-.75-1.76-.83-.24-.09-.41-.13-.58.13-.17.26-.66.83-.81 1-.15.17-.3.2-.56.07-.26-.13-1.09-.4-2.08-1.28-.77-.68-1.29-1.53-1.44-1.79-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.33-.02-.46-.07-.13-.58-1.4-.79-1.92-.21-.5-.43-.43-.58-.44h-.5c-.17 0-.46.07-.7.33-.24.26-.92.9-.92 2.2 0 1.3.94 2.56 1.07 2.74.13.17 1.85 2.82 4.49 3.96.63.27 1.12.43 1.5.55.63.2 1.2.17 1.65.1.5-.07 1.52-.62 1.73-1.22.21-.6.21-1.11.15-1.22-.06-.11-.24-.17-.5-.3ZM16.03 26.67h-.01c-1.8 0-3.55-.49-5.07-1.41l-.36-.21-3.56.93.95-3.47-.23-.36a10.59 10.59 0 0 1-1.64-5.67c0-5.84 4.76-10.59 10.61-10.59 2.83 0 5.49 1.1 7.49 3.1a10.52 10.52 0 0 1 3.11 7.48c0 5.84-4.76 10.6-10.6 10.6Zm9.05-19.68A12.76 12.76 0 0 0 16.01 3.25C8.96 3.25 3.23 8.97 3.23 16.02c0 2.27.6 4.49 1.75 6.45L3 29.73l7.43-1.95a12.7 12.7 0 0 0 5.58 1.29h.01c7.05 0 12.78-5.73 12.78-12.78 0-3.41-1.33-6.61-3.72-9.3Z" />
  </svg>
);

interface Plan {
  name: string;
  valueCents: number;
  displayValue: string;
}

const plans: Plan[] = [
  { name: "3 Meses + Chat Livre", valueCents: 5990, displayValue: "R$ 59,90" },
  { name: "1 mês", valueCents: 1990, displayValue: "R$ 19,90" },
  { name: "6 meses (10% off )", valueCents: 2990, displayValue: "R$ 29,90" },
];

const ProfileCard = () => {
  const [showFullBio, setShowFullBio] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isUpsellModalOpen, setIsUpsellModalOpen] = useState(false);

  // Subscription states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [pixData, setPixData] = useState<{
    transactionId: string;
    qrCode: string;
    qrCodeBase64: string;
  } | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [showDataProtectionUpsell, setShowDataProtectionUpsell] = useState(false);
  const [showContentReleaseUpsell, setShowContentReleaseUpsell] = useState(false);
  

  const handleWhatsAppPaymentSuccess = () => {
    setIsWhatsAppModalOpen(false);
    setIsUpsellModalOpen(true);
  };

  const handleUpsellPaymentSuccess = () => {
    setIsUpsellModalOpen(false);
    window.open("https://wa.me/5511999999999?text=Meu%20acesso%20foi%20liberado!", "_blank");
  };

  const handlePlanClick = async (plan: Plan) => {
    setSelectedPlan(plan);
    setIsLoading(true);
    setIsModalOpen(true);
    setPixData(null);
    trackInitiateCheckout(plan.valueCents, 'BRL', plan.name);

    try {
      const { data, error } = await supabase.functions.invoke('create-pix', {
        body: {
          value: plan.valueCents,
          plan_name: plan.name,
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
      const message = error instanceof Error ? error.message : "Tente novamente em alguns instantes";
      toast({
        title: "Erro ao gerar PIX",
        description: message,
        variant: "destructive",
      });
      setIsModalOpen(false);
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
        const { data } = await supabase.functions.invoke('check-pix-status', {
          body: { transaction_id: transactionId },
        });

        if (data?.status === 'approved' || data?.status === 'paid') {
          clearInterval(pollInterval);
          setIsPolling(false);
          trackPurchase(selectedPlan?.valueCents || 0, 'BRL', selectedPlan?.name);
          trackUtmifyPurchase(selectedPlan?.valueCents || 0, transactionId);
          handleMainPaymentSuccess();
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

  const handleMainPaymentSuccess = () => {
    toast({
      title: "Pagamento confirmado!",
      description: "Seu plano foi ativado",
    });
    setIsModalOpen(false);
    setShowDataProtectionUpsell(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPlan(null);
    setPixData(null);
    setIsPolling(false);
  };

  const handleDataProtectionSuccess = () => {
    setShowDataProtectionUpsell(false);
    setShowContentReleaseUpsell(true);
  };

  const handleDataProtectionDecline = () => {
    setShowDataProtectionUpsell(false);
    setShowContentReleaseUpsell(true);
  };

  const handleContentReleaseSuccess = () => {
    setShowContentReleaseUpsell(false);
    toast({
      title: "🎉 Parabéns!",
      description: "Todos os seus acessos foram liberados!",
    });
    window.location.href = "https://redirect.ravenv1.com/l/kesmn5jm";
  };

  const handleContentReleaseDecline = () => {
    setShowContentReleaseUpsell(false);
    toast({
      title: "Acesso liberado!",
      description: "Seu plano foi ativado com sucesso",
    });
    window.location.href = "https://redirect.ravenv1.com/l/kesmn5jm";
  };

  return (
    <>
      <div className="content-card mx-4">
        {/* Cover Image */}
        <div className="relative h-28 overflow-hidden">
          <img
            src={coverImage}
            alt="Foto de capa da Lais Nascimento"
            className="h-full w-full object-cover object-top"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 to-transparent" />
        </div>

        {/* Profile Info */}
        <div className="px-4 pb-4">
          <div className="flex items-end justify-between -mt-10 mb-3">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-card overflow-hidden bg-muted">
                <img
                  src={profileImage}
                  alt="Foto de perfil da Lais Nascimento"
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground pb-1">
              <span className="flex items-center gap-1">
                <Image className="w-4 h-4" />
                250
              </span>
              <span className="flex items-center gap-1">
                <Film className="w-4 h-4" />
                189
              </span>
              <span className="flex items-center gap-1">
                <Lock className="w-4 h-4" />
                8
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-4 h-4" />
                16.6K
              </span>
            </div>
          </div>

          {/* Name and Bio */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <h2 className="text-xl font-bold text-foreground">Lais Nascimento</h2>
            <BadgeCheck className="w-5 h-5 text-accent fill-accent stroke-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-2">@Alaisnacimento</p>
          
          <p className="text-sm text-foreground leading-relaxed">
            {showFullBio ? (
              <>
                Oiii sou a Lais Roceira do corpão natural🤤 vem ver meu outro lado e descobrir oque esse rostinho esconde, e se impressionar 😏 CONTEÚDO AMADOR 🔥💦
                <button 
                  onClick={() => setShowFullBio(false)}
                  className="text-accent font-medium ml-1 hover:underline"
                >
                  Ver menos
                </button>
              </>
            ) : (
              <>
                Oiii sou a Lais Roceira do corpão natural🤤 vem ver meu outro...
                <button 
                  onClick={() => setShowFullBio(true)}
                  className="text-accent font-medium ml-1 hover:underline"
                >
                  Ler mais
                </button>
              </>
            )}
          </p>

          {/* Social Links */}
          <div className="mt-3 flex items-center gap-2">
            <button
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
              aria-label="Instagram"
              type="button"
            >
              <Instagram className="w-5 h-5 text-foreground" />
            </button>
            <button
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
              aria-label="WhatsApp"
              type="button"
              onClick={() => setIsWhatsAppModalOpen(true)}
            >
              <WhatsAppIcon className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Subscription Section - Integrated */}
          <div className="mt-4">
            <h3 className="text-base font-semibold text-foreground mb-3">Assinaturas</h3>
            
            {/* Main Plan */}
            <button 
              onClick={() => handlePlanClick(plans[0])}
              className="subscription-button"
            >
              <span className="text-sm">{plans[0].name}</span>
              <span className="text-sm font-semibold">{plans[0].displayValue}</span>
            </button>

            {/* Promoções Label */}
            <h3 className="text-base font-semibold text-foreground mt-4 mb-3">Promoções</h3>
            
            {/* Promo Plans */}
            <div className="space-y-3">
              {plans.slice(1).map((plan) => (
                <button 
                  key={plan.name}
                  onClick={() => handlePlanClick(plan)}
                  className="promo-button"
                >
                  <span className="text-sm">{plan.name}</span>
                  <span className="text-sm font-semibold">{plan.displayValue}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      <WhatsAppModal 
        isOpen={isWhatsAppModalOpen} 
        onClose={() => setIsWhatsAppModalOpen(false)}
        onPaymentSuccess={handleWhatsAppPaymentSuccess}
      />

      {/* Upsell Modal */}
      <UpsellModal
        isOpen={isUpsellModalOpen}
        onClose={() => setIsUpsellModalOpen(false)}
        onPaymentSuccess={handleUpsellPaymentSuccess}
      />

      {/* PIX Payment Modal */}
      <PixPaymentModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        planName={selectedPlan?.name || ""}
        value={selectedPlan?.valueCents || 0}
        transactionId={pixData?.transactionId || ""}
        qrCode={pixData?.qrCode || ""}
        qrCodeBase64={pixData?.qrCodeBase64 || ""}
        isLoading={isLoading}
      />

      {/* Upsell 1: Data Protection */}
      <DataProtectionUpsellModal
        isOpen={showDataProtectionUpsell}
        onClose={() => setShowDataProtectionUpsell(false)}
        onPaymentSuccess={handleDataProtectionSuccess}
        onDecline={handleDataProtectionDecline}
      />

      {/* Upsell 2: Content Release */}
      <ContentReleaseUpsellModal
        isOpen={showContentReleaseUpsell}
        onClose={() => setShowContentReleaseUpsell(false)}
        onPaymentSuccess={handleContentReleaseSuccess}
        onDecline={handleContentReleaseDecline}
      />
    </>
  );
};

export default ProfileCard;
