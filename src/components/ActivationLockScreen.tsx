import React, { useState } from 'react';
import { 
  Lock, 
  Smartphone, 
  Copy, 
  Check, 
  Send, 
  KeyRound, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { getDeviceId, activateApp } from '../services/licenseService';

interface ActivationLockScreenProps {
  onActivated: () => void;
  onOpenAdminGenerator: () => void;
}

export const ActivationLockScreen: React.FC<ActivationLockScreenProps> = ({
  onActivated,
  onOpenAdminGenerator
}) => {
  const deviceId = getDeviceId();
  const [enteredKey, setEnteredKey] = useState('');
  const [userNameInput, setUserNameInput] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [errorMsg, setErrorMsg] = useState(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('ribo_license_revoked') === 'true') {
      return 'Vaša licenca za ovaj uređaj je ukinuta od strane administratora.';
    }
    return '';
  });
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(deviceId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  const handleSendIdToOwner = () => {
    const namePart = userNameInput.trim() ? ` (Ime: ${userNameInput.trim()})` : '';
    const text = `Pozdrav Daniel, molim te aktivacijski ključ za aplikaciju RiboPrognoza${namePart}.\n\nID mog uređaja je: ${deviceId}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (navigator.share) {
      navigator.share({
        title: 'RiboPrognoza ID uređaja',
        text
      }).catch(() => {
        window.open(whatsappUrl, '_blank');
      });
    } else {
      window.open(whatsappUrl, '_blank');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!enteredKey.trim()) {
      setErrorMsg('Molimo unesite aktivacijski ključ.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await activateApp(enteredKey.trim(), userNameInput.trim());
      if (res.success) {
        setIsSuccess(true);
        setTimeout(() => {
          onActivated();
        }, 900);
      } else {
        setErrorMsg(res.message || 'Nevažeći aktivacijski ključ za ovaj uređaj.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 w-full max-w-full font-sans select-none">
      
      {/* Gornji dio / Brand */}
      <div className="pt-6 sm:pt-10 flex flex-col items-center text-center">
        <div className="relative mb-3">
          <img 
            src="/pwa-192x192.png" 
            alt="RiboPrognoza Zander Masters" 
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shadow-xl ring-4 ring-cyan-500/20 object-cover"
          />
          <div className="absolute -bottom-2 -right-2 bg-amber-500 text-slate-950 p-1.5 rounded-xl shadow-md border-2 border-slate-950">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          RiboPrognoza
        </h1>
        <p className="text-xs sm:text-sm text-cyan-400 font-semibold mt-1">
          Dunav (Aljmaš & Bogojevo) • Solunar
        </p>
      </div>

      {/* Središnji dio: Kartica za aktivaciju */}
      <div className="max-w-md w-full mx-auto my-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
        
        <div className="text-center space-y-1">
          <h2 className="text-base sm:text-lg font-black text-white">
            Aktivacija Licence
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Aplikacija je zaštićena i veže se isključivo za vaš mobitel. Pošaljite ID autoru kako biste dobili svoj ključ.
          </p>
        </div>

        {/* Prikaz ID-a uređaja */}
        <div className="bg-slate-950 border border-cyan-500/30 rounded-2xl p-4 text-center space-y-2.5">
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
            ID Vašeg Uređaja:
          </span>
          <div className="font-mono text-xl sm:text-2xl font-black text-cyan-300 tracking-widest bg-slate-900/90 py-2 px-3 rounded-xl border border-slate-800 select-all">
            {deviceId}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleCopyId}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition-all active:scale-95"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId ? 'Kopirano!' : 'Kopiraj ID'}</span>
            </button>
            <button
              onClick={handleSendIdToOwner}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs cursor-pointer transition-all active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Pošalji autoru</span>
            </button>
          </div>
        </div>

        {/* Obrazac za unos aktivacijskog koda */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Vaše ime ili nadimak (za interni ribički chat):
            </label>
            <input
              type="text"
              value={userNameInput}
              onChange={(e) => setUserNameInput(e.target.value)}
              placeholder="npr. Mario Vinkovci ili Pero - Aljmaš"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Unesite aktivacijski ključ:
            </label>
            <div className="relative">
              <input
                type="text"
                value={enteredKey}
                onChange={(e) => {
                  setEnteredKey(e.target.value.toUpperCase());
                  setErrorMsg('');
                }}
                placeholder="npr. AKT-8B3E-72C9"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-3 text-center font-mono text-base tracking-widest uppercase text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSuccess && (
            <div className="flex items-center gap-2 p-3 bg-teal-950/40 border border-teal-500/40 rounded-xl text-teal-300 text-xs font-bold">
              <Check className="w-4 h-4 shrink-0 text-teal-400" />
              <span>Aplikacija uspješno aktivirana! Učitavanje...</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSuccess}
            className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm tracking-wide transition-all shadow-lg shadow-cyan-900/30 cursor-pointer active:scale-95"
          >
            Aktiviraj Aplikaciju
          </button>
        </form>

      </div>

      {/* Donji dio: Prikaz autora i skriveni ulaz za Danielov Generator */}
      <div className="pb-4 text-center space-y-2">
        <p className="text-xs text-slate-500 font-medium">
          RiboPrognoza created by Daniel Čizmar • All rights reserved
        </p>

        <div>
          <button
            onClick={onOpenAdminGenerator}
            className="text-[11px] text-slate-500 hover:text-amber-400 transition-colors inline-flex items-center gap-1 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-slate-900"
          >
            <KeyRound className="w-3 h-3 text-amber-500/70" />
            <span>Autor aplikacije (Generator ključeva)</span>
          </button>
        </div>
      </div>

    </div>
  );
};
