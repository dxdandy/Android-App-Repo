import React, { useState } from 'react';
import { 
  Smartphone, 
  Download, 
  X, 
  CheckCircle2, 
  ExternalLink, 
  Laptop, 
  Layers, 
  Share2, 
  Zap, 
  FileCode2, 
  Terminal
} from 'lucide-react';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'pwa' | 'pc' | 'apk'>('pwa');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl relative my-8">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-5">
          <img 
            src="/pwa-192x192.png" 
            alt="RiboPrognoza ikona" 
            className="w-12 h-12 rounded-2xl object-cover border border-cyan-500/30 shadow-md shrink-0" 
            referrerPolicy="no-referrer" 
          />
          <div>
            <h3 className="text-xl font-black text-white">
              Vodič: Preuzimanje i instalacija na Android
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Kako pokrenuti aplikaciju na mobitelu ili je skinuti na računalo
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 mb-5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'pwa'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>1. Izravno na Android (Preporučeno)</span>
          </button>
          
          <button
            onClick={() => setActiveTab('pc')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'pc'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>2. Preuzimanje na PC</span>
          </button>

          <button
            onClick={() => setActiveTab('apk')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'apk'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. Izrada APK paketa</span>
          </button>
        </div>

        {/* Tab 1: PWA direktno na Android (najjednostavniji način) */}
        {activeTab === 'pwa' && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-300">
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-200">
              <span className="font-bold block text-white text-sm mb-1">
                ⭐ Najbrži i najjednostavniji način (Bez kabela i bez računala):
              </span>
              Ova aplikacija je konfigurirana kao <strong>Progresivna Web Aplikacija (PWA)</strong>. To znači da je možete instalirati izravno iz preglednika na vaš Android telefon za 10 sekundi!
            </div>

            <ol className="space-y-3 font-sans list-decimal list-inside bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              <li className="leading-relaxed">
                <strong className="text-white">Otvorite ovu poveznicu u Google Chromeu</strong> na vašem Android mobitelu.
              </li>
              <li className="leading-relaxed">
                Kliknite na <strong className="text-white">tri točkice (⋮)</strong> u gornjem desnom kutu Chrome preglednika.
              </li>
              <li className="leading-relaxed">
                U izborniku odaberite <strong className="text-emerald-400 font-bold">"Dodaj na početni zaslon"</strong> (Add to Home screen) ili <strong className="text-emerald-400 font-bold">"Instaliraj aplikaciju"</strong> (Install App).
              </li>
              <li className="leading-relaxed">
                Potvrdite instalaciju klikom na <strong className="text-white">"Instaliraj"</strong>.
              </li>
            </ol>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Nativna ikona:</strong> Aplikacija dobiva svoju ikonu "RiboPrognoza" na početnom zaslonu uz ostale aplikacije.</span>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Cijeli zaslon (Fullscreen):</strong> Otvara se bez adresne trake preglednika, točno kao prava aplikacija iz Trgovine Play.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Preuzimanje koda na računalo */}
        {activeTab === 'pc' && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-300">
            <p>
              Cijeli izvorni kod aplikacije (React, TypeScript, Tailwind, Express backend i skripte za scraping hidrometeo podataka) možete preuzeti na svoje računalo:
            </p>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs">
                <span className="text-slate-400 block mb-1"># 1. Kloniranje ili preuzimanje projekta:</span>
                <span className="text-cyan-300">git clone &lt;repozitorij&gt;</span>
                <span className="text-slate-500 block text-[11px] mt-0.5">Ili preuzmite ZIP arhivu s AI Studio radnog prostora</span>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs">
                <span className="text-slate-400 block mb-1"># 2. Instalacija ovisnosti (Node.js i npm):</span>
                <span className="text-cyan-300">npm install</span>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs">
                <span className="text-slate-400 block mb-1"># 3. Pokretanje lokalnog poslužitelja:</span>
                <span className="text-cyan-300">npm run dev</span>
                <span className="text-slate-500 block text-[11px] mt-0.5">Aplikacija se pokreće na http://localhost:3000</span>
              </div>
            </div>

            <div className="p-3 bg-cyan-950/40 rounded-xl border border-cyan-800/40 text-cyan-200 text-xs">
              💡 <strong>Savjet za rad na računalu:</strong> Kada pokrenete <code className="text-white">npm run dev</code>, poslužitelj automatski pokreće Express backend koji bez CORS ograničenja povlači podatke s mvodostaji.voda.hr i hidmet.gov.rs.
            </div>
          </div>
        )}

        {/* Tab 3: Izrada samostalnog APK paketa za Android */}
        {activeTab === 'apk' && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-300">
            <p>
              Ako želite generirati pravi samostalni instalacijski paket <strong className="text-white">.APK</strong> koji se može slati putem WhatsAppa ili instalirati direktno na Android telefon:
            </p>

            <div className="space-y-3">
              
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-white text-sm">Metoda A: PWABuilder (Preporučeno & Besplatno)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">1-Klik APK</span>
                </div>
                <p className="text-xs text-slate-300 mb-2">
                  Otvorite službenu Microsoftovu platformu <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-bold">pwabuilder.com</a>, unesite adresu vaše aplikacije i kliknite <strong>"Package for Android"</strong>.
                </p>
                <span className="text-[11px] text-slate-400 block">
                  Generira gotov potpisani <strong>.apk</strong> i <strong>.aab</strong> spreman za mobitel ili Google Play Store.
                </span>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
                <span className="font-bold text-white text-sm block mb-1.5">Metoda B: Capacitor / Android Studio</span>
                <p className="text-xs text-slate-300 mb-2">
                  Na računalu unutar mape projekta možete dodati Capacitor:
                </p>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-cyan-300 space-y-1">
                  <div>npm install @capacitor/core @capacitor/android</div>
                  <div>npx cap add android</div>
                  <div>npm run build && npx cap sync</div>
                  <div>npx cap open android</div>
                </div>
                <span className="text-[11px] text-slate-400 block mt-2">
                  U Android Studiju odaberite <em>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK</em>.
                </span>
              </div>

            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Zatvori vodič
          </button>
        </div>

      </div>

    </div>
  );
};
