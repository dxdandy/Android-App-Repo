import React, { useState } from 'react';
import { 
  Rocket, 
  Download, 
  Clock, 
  X, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { 
  AppVersionInfo, 
  CURRENT_APP_VERSION, 
  startApkDownload, 
  dismissUpdateFor24h
} from '../services/updateService';

interface AppUpdateModalProps {
  updateInfo: AppVersionInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  updateInfo,
  isOpen,
  onClose
}) => {
  const [downloadStarted, setDownloadStarted] = useState(false);

  if (!isOpen || !updateInfo) return null;

  const handleDownloadApk = () => {
    setDownloadStarted(true);
    startApkDownload(updateInfo.apkUrl);
  };

  const handleRemindLater = () => {
    dismissUpdateFor24h(updateInfo.version);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-cyan-500/50 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl relative text-white space-y-4">
        
        {/* Gumb za zatvaranje */}
        {!updateInfo.isCritical && (
          <button
            onClick={handleRemindLater}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 cursor-pointer transition-colors"
            title="Zatvori"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Zaglavlje s ikonom */}
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shrink-0 bg-gradient-to-tr from-cyan-600 to-teal-400 shadow-cyan-500/20">
            <Rocket className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider bg-cyan-950 text-cyan-300 border-cyan-500/40">
                Novo Ažuriranje
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {updateInfo.releaseDate}
              </span>
            </div>
            <h2 className="text-lg font-black text-white leading-tight mt-0.5">
              Dostupna je nova verzija!
            </h2>
          </div>
        </div>

        {/* Usporedba verzija */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-around text-center">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Instalirano</span>
            <span className="font-mono text-xs font-bold text-slate-300">v{CURRENT_APP_VERSION}</span>
          </div>
          <div className="text-cyan-400 font-black text-base">➔</div>
          <div>
            <span className="text-[10px] text-emerald-400 block font-semibold uppercase">Nova verzija</span>
            <span className="font-mono text-sm font-black text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-500/40">
              v{updateInfo.version}
            </span>
          </div>
        </div>

        {/* Što je novo */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Što donosi verzija v{updateInfo.version}:</span>
          </span>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 max-h-36 overflow-y-auto space-y-1.5 text-xs text-slate-300">
            {updateInfo.changelog && updateInfo.changelog.length > 0 ? (
              updateInfo.changelog.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{item}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 italic">Poboljšanja performansi, stabilnosti i točnosti vodostaja.</p>
            )}
          </div>
        </div>

        {/* Uputa za instalaciju ako je preuzimanje pokrenuto */}
        {downloadStarted ? (
          <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-2xl p-3 space-y-2 text-xs text-cyan-200">
            <div className="flex items-center gap-2 font-bold text-cyan-300">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Preuzimanje instalacijske datoteke je u tijeku</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              Nakon što preuzimanje završi, dodirnite preuzetu APK datoteku u obavijestima mobitela. Ako Android prikaže Google Play Protect upit, kliknite na <strong>"Više pojedinosti"</strong> i odaberite <strong>"Instaliraj svejedno"</strong>.
            </p>
          </div>
        ) : (
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-2.5 flex items-start gap-2 text-[11px] text-slate-400">
            <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>Instalacija ažurira aplikaciju na najnoviju verziju uz očuvanje svih vaših postavki i poruka u chatu.</span>
          </div>
        )}

        {/* Gumbi za akciju */}
        <div className="space-y-2 pt-1">
          <button
            onClick={handleDownloadApk}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-sm tracking-wide transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span>{downloadStarted ? 'Ponovno preuzmi instalacijsku datoteku (APK)' : 'Preuzmi i instaliraj ažuriranje (APK)'}</span>
          </button>

          {!updateInfo.isCritical && (
            <button
              onClick={handleRemindLater}
              className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Podsjeti me sutra</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
