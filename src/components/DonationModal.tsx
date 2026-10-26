import React, { useState } from 'react';
import { 
  Heart, 
  CreditCard, 
  Copy, 
  Check, 
  X, 
  Sparkles,
  Coffee,
  ShieldCheck
} from 'lucide-react';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DonationModal: React.FC<DonationModalProps> = ({
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const cardNumber = '4165 9809 1649 5738';
  const cleanCardNumber = '4165980916495738';

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanCardNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl relative text-white space-y-5">
        
        {/* Zatvori gumb */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 cursor-pointer transition-colors"
          title="Zatvori"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Zaglavlje s ikonom */}
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
            <Heart className="w-6 h-6 fill-slate-950 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                Podrška autoru
              </span>
            </div>
            <h2 className="text-lg font-black text-white leading-tight mt-0.5">
              Donacija za čevape i Colu 🍔🥤
            </h2>
          </div>
        </div>

        {/* Opis */}
        <p className="text-xs text-slate-300 leading-relaxed">
          Aplikacija je potpuno besplatna za korištenje. Ako vam koristi na vodi, rad autora možete podržati dobrovoljnom donacijom za čevape i hladnu Colu!
        </p>

        {/* Kartica računa za uplatu */}
        <div className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-amber-400" />
              Visa račun za uplatu:
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              Daniel Čizmar
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <div className="font-mono text-lg sm:text-xl font-black text-amber-300 tracking-wider select-all">
              {cardNumber}
            </div>
          </div>

          <button
            onClick={handleCopy}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-950" />
                <span>Broj računa kopiran!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Kopiraj broj računa</span>
              </>
            )}
          </button>
        </div>

        {/* Dodatne informacije */}
        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
          <div className="flex justify-between">
            <span>Primatelj:</span>
            <strong className="text-slate-200">Daniel Čizmar</strong>
          </div>
          <div className="flex justify-between">
            <span>Svrha:</span>
            <strong className="text-slate-200">Donacija za RiboPrognozu</strong>
          </div>
        </div>

        {/* Hvala poruka */}
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/20 border border-amber-500/20 rounded-xl text-[11px] text-amber-300">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Od srca hvala na svakoj podršci i bistro na Dunavu! 🎣</span>
        </div>

        {/* Gumb za zatvaranje */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
        >
          Zatvori
        </button>

      </div>
    </div>
  );
};
