import React, { useState } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  Copy, 
  Check, 
  Share2, 
  X, 
  Smartphone,
  Sparkles,
  Lock
} from 'lucide-react';
import { 
  generateActivationKey, 
  getDeviceId, 
  activateApp, 
  checkAdminPin 
} from '../services/licenseService';

interface AdminKeyGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelfActivated?: () => void;
}

export const AdminKeyGeneratorModal: React.FC<AdminKeyGeneratorModalProps> = ({
  isOpen,
  onClose,
  onSelfActivated
}) => {
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);

  const [targetDeviceId, setTargetDeviceId] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [selfActivatedMsg, setSelfActivatedMsg] = useState(false);

  if (!isOpen) return null;

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkAdminPin(pinInput)) {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeviceId.trim()) return;
    const key = generateActivationKey(targetDeviceId.trim());
    setGeneratedKey(key);
    setCopiedKey(false);
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleShareKey = () => {
    if (!generatedKey) return;
    const text = `Pozdrav! Tvoj aktivacijski ključ za RiboPrognoza aplikaciju (uređaj: ${targetDeviceId}):\n\n${generatedKey}\n\nUnesi ga u aplikaciju za trajno otključavanje.`;
    if (navigator.share) {
      navigator.share({
        title: 'RiboPrognoza Aktivacijski Ključ',
        text
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  };

  const handleActivateThisPhone = () => {
    const myId = getDeviceId();
    const myKey = generateActivationKey(myId);
    activateApp(myKey);
    setSelfActivatedMsg(true);
    if (onSelfActivated) {
      setTimeout(() => {
        onSelfActivated();
        onClose();
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl relative text-white">
        
        {/* Zatvori gumb */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Naslov */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white leading-tight">
              Generator Ključeva
            </h2>
            <p className="text-xs text-amber-400 font-medium">
              Autor: Daniel Čizmar (Admin)
            </p>
          </div>
        </div>

        {!isAuthenticated ? (
          /* Korak 1: Unos PIN-a */
          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
              <label className="block text-xs text-slate-300 font-bold mb-2">
                Unesite administratorski PIN (zadano: 2026):
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="Unesite PIN"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-lg tracking-widest text-white focus:outline-none focus:border-amber-400"
                  autoFocus
                />
              </div>
              {pinError && (
                <p className="text-rose-400 text-xs mt-2 font-bold text-center">
                  Pogrešan PIN. Pokušajte ponovno.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-all shadow-md cursor-pointer"
            >
              Otključaj Generator
            </button>
          </form>
        ) : (
          /* Korak 2: Izračun ključa za uređaj kupca/prijatelja */
          <div className="space-y-5">
            
            {/* Gumb za brzo otključavanje Danielovog mobitela */}
            <div className="p-3 bg-teal-950/40 border border-teal-500/30 rounded-2xl flex items-center justify-between gap-3">
              <div className="text-xs">
                <span className="font-bold text-teal-300 block">Vaš vlastiti mobitel:</span>
                <span className="font-mono text-slate-400 text-[11px]">{getDeviceId()}</span>
              </div>
              <button
                type="button"
                onClick={handleActivateThisPhone}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shrink-0 cursor-pointer transition-all"
              >
                {selfActivatedMsg ? '✓ Aktivirano!' : 'Otključaj moj mobitel'}
              </button>
            </div>

            {/* Obrazac za izračun ključa za bilo koji drugi mobitel */}
            <form onSubmit={handleGenerate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  ID uređaja kupca / prijatelja:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={targetDeviceId}
                    onChange={(e) => setTargetDeviceId(e.target.value.toUpperCase())}
                    placeholder="npr. RP-8B3E-72C9"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-center font-mono text-sm tracking-wider uppercase text-white focus:outline-none focus:border-amber-400"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!targetDeviceId.trim()}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer"
              >
                Izračunaj Aktivacijski Ključ
              </button>
            </form>

            {/* Prikaz izračunatog ključa */}
            {generatedKey && (
              <div className="p-4 bg-slate-950 border border-amber-500/50 rounded-2xl text-center space-y-3">
                <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider block">
                  Aktivacijski ključ za {targetDeviceId}:
                </span>
                <div className="font-mono text-lg font-black text-white bg-slate-900 border border-slate-800 py-2.5 px-3 rounded-xl select-all tracking-widest">
                  {generatedKey}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleCopyKey}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition-all"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Kopirano!' : 'Kopiraj ključ'}</span>
                  </button>
                  <button
                    onClick={handleShareKey}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer transition-all"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Pošalji porukom</span>
                  </button>
                </div>
              </div>
            )}

            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Ključ je kriptografski vezan isključivo za uneseni ID uređaja i ne može se aktivirati na drugom mobitelu.
            </p>

          </div>
        )}

      </div>
    </div>
  );
};
