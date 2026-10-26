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
  Lock,
  RefreshCw,
  Globe,
  AlertCircle,
  CheckCircle2,
  Terminal,
  Download
} from 'lucide-react';
import { 
  generateActivationKey, 
  getDeviceId, 
  activateApp, 
  checkAdminPin 
} from '../services/licenseService';
import { 
  runUpdateDiagnostic, 
  CURRENT_APP_VERSION, 
  setSavedGithubRepo,
  AppVersionInfo 
} from '../services/updateService';

interface AdminKeyGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelfActivated?: () => void;
  onTestUpdatePopup?: (fakeInfo: AppVersionInfo) => void;
}

export const AdminKeyGeneratorModal: React.FC<AdminKeyGeneratorModalProps> = ({
  isOpen,
  onClose,
  onSelfActivated,
  onTestUpdatePopup
}) => {
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);

  const [activeTab, setActiveTab] = useState<'licence' | 'azuriranja'>('licence');

  // Stanja za licence
  const [targetDeviceId, setTargetDeviceId] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [selfActivatedMsg, setSelfActivatedMsg] = useState(false);

  // Stanja za ažuriranja
  const [githubRepoInput, setGithubRepoInput] = useState(() => {
    try {
      return localStorage.getItem('ribo_github_repo') || 'dxdandy/Android-App-Repo';
    } catch {
      return 'dxdandy/Android-App-Repo';
    }
  });
  const [repoSavedMsg, setRepoSavedMsg] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);

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

  const handleRunDiagnostic = async () => {
    setIsDiagnosing(true);
    setDiagnosticResult(null);
    try {
      const result = await runUpdateDiagnostic();
      setDiagnosticResult(result);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleTriggerTestPopup = () => {
    if (onTestUpdatePopup) {
      onTestUpdatePopup({
        version: '1.0.2',
        name: 'RiboPrognoza',
        releaseDate: new Date().toISOString().split('T')[0],
        apkUrl: 'https://github.com/dani4galaxy/riboprognoza/releases/latest/download/app-release.apk',
        changelog: [
          'Testna simulacija nadogradnje aplikacije',
          'Sve funkcije rade ispravno i spremne su za korisnike'
        ],
        isCritical: false
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl relative text-white max-h-[90vh] overflow-y-auto">
        
        {/* Zatvori gumb */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Naslov */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white leading-tight">
              Upravljačka Ploča
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
              Otključaj Admin Ploču
            </button>
          </form>
        ) : (
          /* Korak 2: Admin sučelje s tabovima */
          <div className="space-y-4">
            
            {/* Tabovi */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
              <button
                onClick={() => setActiveTab('licence')}
                className={`py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'licence' 
                    ? 'bg-amber-500 text-slate-950 shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Licence & Kodovi
              </button>
              <button
                onClick={() => setActiveTab('azuriranja')}
                className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === 'azuriranja' 
                    ? 'bg-cyan-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Ažuriranja</span>
              </button>
            </div>

            {activeTab === 'licence' ? (
              /* TAB 1: GENERATOR LICENCI */
              <div className="space-y-4">
                {/* Gumb za brzo otključavanje Danielovog mobitela */}
                <div className="p-3 bg-teal-950/40 border border-teal-500/30 rounded-2xl flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="font-bold text-teal-300 block">Vaš mobitel:</span>
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
                    <input
                      type="text"
                      value={targetDeviceId}
                      onChange={(e) => setTargetDeviceId(e.target.value.toUpperCase())}
                      placeholder="npr. RP-8B3E-72C9"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-center font-mono text-sm tracking-wider uppercase text-white focus:outline-none focus:border-amber-400"
                    />
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
              </div>
            ) : (
              /* TAB 2: AŽURIRANJA I DIJAGNOSTIKA */
              <div className="space-y-4">
                <div className="bg-slate-950 border border-cyan-500/30 rounded-2xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Instalirana verzija na mobitelu:</span>
                    <span className="font-mono font-bold text-cyan-300">v{CURRENT_APP_VERSION}</span>
                  </div>
                </div>

                {/* Postavka GitHub repozitorija */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                  <label className="block text-[11px] font-bold text-slate-300">
                    GitHub repozitorij (Korisnik / Repozitorij):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={githubRepoInput}
                      onChange={(e) => setGithubRepoInput(e.target.value)}
                      placeholder="dxdandy/Android-App-Repo"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSavedGithubRepo(githubRepoInput);
                        setRepoSavedMsg(true);
                        setTimeout(() => setRepoSavedMsg(false), 2000);
                        handleRunDiagnostic();
                      }}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white font-bold text-xs cursor-pointer shrink-0"
                    >
                      {repoSavedMsg ? '✓ Spremljeno!' : 'Spremi'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    S ovog repozitorija mobitel preuzima <code>version.json</code> i novi APK.
                  </p>
                </div>

                {/* Gumb za test dijagnostike */}
                <button
                  type="button"
                  onClick={handleRunDiagnostic}
                  disabled={isDiagnosing}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
                  <span>{isDiagnosing ? 'Provjera veze u tijeku...' : 'Testiraj vezu sa serverom'}</span>
                </button>

                {/* Rezultat dijagnostike */}
                {diagnosticResult && (
                  <div className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                    diagnosticResult.success 
                      ? 'bg-teal-950/40 border-teal-500/40 text-teal-200' 
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {diagnosticResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                          <span>Povezano s poslužiteljem!</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>Greška pri povezivanju:</span>
                        </>
                      )}
                    </div>

                    {diagnosticResult.success ? (
                      <div className="space-y-1 text-[11px] pt-1">
                        <div>• Najnovija verzija na serveru: <strong>v{diagnosticResult.serverVersion}</strong></div>
                        <div>• Verzija na ovom mobitelu: <strong>v{diagnosticResult.currentVersion}</strong></div>
                        <div>
                          • Status: {diagnosticResult.hasUpdate ? (
                            <span className="text-amber-400 font-bold">🚀 Dostupna je nova verzija!</span>
                          ) : (
                            <span className="text-teal-400 font-bold">✓ Imate najnoviju verziju.</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-rose-300">
                        {diagnosticResult.error}
                      </p>
                    )}

                    {/* Detalji svih provjerenih adresa */}
                    {diagnosticResult.details && diagnosticResult.details.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-300 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">
                          Pregled adresa:
                        </span>
                        {diagnosticResult.details.map((d: string, idx: number) => (
                          <div key={idx} className="break-all">{d}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Gumb za isprobavanje skočnog prozora */}
                <div className="pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleTriggerTestPopup}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Isprobaj skočni prozor za novu verziju (Test)</span>
                  </button>
                  <p className="text-[10px] text-slate-500 text-center mt-1.5">
                    Otvara skočni prozor kako biste vidjeli točno kako ga vaši korisnici vide.
                  </p>
                </div>

              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
