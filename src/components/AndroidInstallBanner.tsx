import React, { useState } from 'react';
import { Smartphone, Download, X, CheckCircle, Info } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const AndroidInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isAndroid, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  if (dismissed || isInstalled) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-cyan-900 via-slate-900 to-teal-950 text-white border-b border-cyan-800/60 py-2.5 px-4 sm:px-6 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        
        {/* Info */}
        <div className="flex items-center space-x-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold flex items-center gap-1.5 text-white">
              <span>Android aplikacija za ribolov</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-semibold border border-emerald-500/40">
                APK / PWA
              </span>
            </div>
            <p className="text-slate-300 text-[11px]">
              Instalirajte RiboPrognozu na svoj Android uređaj za brzi pristup s početnog zaslona i rad bez interneta na vodi.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
          {isInstallable ? (
            <button
              onClick={install}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instaliraj na Android</span>
            </button>
          ) : (
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Kako instalirati na Android?</span>
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Sakrij obavijest"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Android Instructions Dropdown */}
      {showInstructions && (
        <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-slate-700/60 text-[11px] text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <strong>Upute za instalaciju na Android mobitelu (Chrome / Edge / Samsung Internet):</strong><br />
            1. Dodirnite ikonu izbornika (<strong>tri točkice ⋮</strong>) u gornjem desnom kutu preglednika.<br />
            2. Odaberite <strong>"Instaliraj aplikaciju"</strong> ili <strong>"Dodaj na početni zaslon"</strong>.
          </div>
          <button
            onClick={() => setShowInstructions(false)}
            className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 cursor-pointer self-end sm:self-auto"
          >
            U redu
          </button>
        </div>
      )}
    </div>
  );
};
