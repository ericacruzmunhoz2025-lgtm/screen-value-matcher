// UTM Parameter Capture and Storage

const UTM_STORAGE_KEY = 'utm_params';

export interface UTMParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  src: string | null;
  sck: string | null;
}

// Captura UTMs da URL e salva no localStorage
export function captureUTMParams(): void {
  if (typeof window === 'undefined') return;

  const urlParams = new URLSearchParams(window.location.search);
  
  const newParams: UTMParams = {
    utm_source: urlParams.get('utm_source'),
    utm_medium: urlParams.get('utm_medium'),
    utm_campaign: urlParams.get('utm_campaign'),
    utm_content: urlParams.get('utm_content'),
    utm_term: urlParams.get('utm_term'),
    src: urlParams.get('src'),
    sck: urlParams.get('sck'),
  };

  // Só salva se tiver pelo menos um parâmetro
  const hasParams = Object.values(newParams).some(v => v !== null);
  
  if (hasParams) {
    // Merge com parâmetros existentes (novos sobrescrevem)
    const existing = getStoredUTMParams();
    const merged = { ...existing };
    
    Object.entries(newParams).forEach(([key, value]) => {
      if (value !== null) {
        merged[key as keyof UTMParams] = value;
      }
    });
    
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(merged));
    console.log('UTM params captured:', merged);
  }
}

// Retorna os UTMs salvos
export function getStoredUTMParams(): UTMParams {
  if (typeof window === 'undefined') {
    return getEmptyUTMParams();
  }

  try {
    const stored = localStorage.getItem(UTM_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading UTM params:', e);
  }

  return getEmptyUTMParams();
}

// Retorna UTMs vazios
function getEmptyUTMParams(): UTMParams {
  return {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    src: null,
    sck: null,
  };
}

// Limpa UTMs após conversão (opcional)
export function clearUTMParams(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(UTM_STORAGE_KEY);
  }
}
