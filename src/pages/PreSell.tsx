import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import modeloImg from "@/assets/modelo-presell.jpg";
import privacyLogo from "@/assets/privacy-logo.png";

const PreSell = () => {
  const navigate = useNavigate();

  // Tracking - PageView ao carregar a página
  useEffect(() => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, []);

  const handlePrivacyClick = () => {
    // Track click event
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_name: 'PreSell Click',
      });
    }
    navigate("/perfil");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-400 via-purple-400 to-orange-300 flex flex-col items-center pt-12 pb-8 px-4">
      {/* Foto de perfil */}
      <div className="relative mb-6">
        <div className="w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden border-4 border-white shadow-xl">
          <img 
            src={modeloImg} 
            alt="Modelo" 
            className="w-full h-full object-cover object-top"
          />
        </div>
      </div>

      {/* Card branco com botão */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-6">
        {/* Botão Privacy */}
        <button
          onClick={handlePrivacyClick}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-orange-400 hover:shadow-lg text-gray-800 px-6 py-4 text-lg font-medium rounded-2xl shadow-md transition-all duration-300 hover:scale-[1.02]"
        >
          <img src={privacyLogo} alt="Privacy" className="h-8" />
        </button>
      </div>
    </div>
  );
};

export default PreSell;
