import React, { useState, useEffect } from 'react';
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
  Download,
  Users,
  MessageSquare,
  Trash2,
  Edit2,
  UserCheck,
  UserX,
  Search,
  UserPlus,
  ShieldAlert,
  Ban
} from 'lucide-react';
import { 
  generateActivationKey, 
  getDeviceId, 
  activateApp, 
  checkAdminPin,
  fetchAdminLicenses,
  addAdminLicense,
  updateAdminLicense,
  deleteAdminLicense,
  LicenseRecord
} from '../services/licenseService';
import { 
  fetchChatMessages,
  fetchChatMessagesForAdmin,
  deleteChatMessageAsAdmin,
  ChatMessage
} from '../services/chatService';
import { 
  runUpdateDiagnostic, 
  CURRENT_APP_VERSION, 
  setSavedGithubRepo,
  AppVersionInfo,
  cleanupInstallationFiles 
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

  const [activeTab, setActiveTab] = useState<'korisnici' | 'generator' | 'chat' | 'azuriranja'>('korisnici');

  // Stanja za generator
  const [targetDeviceId, setTargetDeviceId] = useState('');
  const [targetUserName, setTargetUserName] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [selfActivatedMsg, setSelfActivatedMsg] = useState(false);

  // Stanja za listu korisnika / licenci
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [isLoadingLicenses, setIsLoadingLicenses] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [licenseSearchQuery, setLicenseSearchQuery] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Stanja za ručni unos postojećeg/novog korisnika
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserKey, setNewUserKey] = useState('');
  const [newUserChatEnabled, setNewUserChatEnabled] = useState(true);
  const [newUserStatus, setNewUserStatus] = useState<'active' | 'revoked'>('active');
  const [newUserNotes, setNewUserNotes] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Stanja za nadzor chata
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

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
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  const loadLicensesData = async () => {
    setIsLoadingLicenses(true);
    try {
      const data = await fetchAdminLicenses(pinInput || '2026');
      setLicenses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingLicenses(false);
    }
  };

  const loadChatData = async () => {
    setIsLoadingChat(true);
    try {
      const data = await fetchChatMessagesForAdmin(pinInput || '2026');
      setChatMessages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingChat(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'korisnici') loadLicensesData();
      if (activeTab === 'chat') loadChatData();
    }
  }, [isAuthenticated, activeTab]);

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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeviceId.trim()) return;
    const cleanId = targetDeviceId.trim().toUpperCase();
    const key = generateActivationKey(cleanId);
    setGeneratedKey(key);
    setCopiedKey(false);

    // Ako je admin upisao ime, odmah registriramo/ažuriramo na poslužitelju
    if (targetUserName.trim()) {
      try {
        await updateAdminLicense(pinInput || '2026', {
          deviceId: cleanId,
          userName: targetUserName.trim(),
          status: 'active'
        });
        loadLicensesData();
      } catch (err) {
        console.error('Greška pri automatskom spremanju imena:', err);
      }
    }
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleShareKey = () => {
    if (!generatedKey) return;
    const greeting = targetUserName.trim() ? `Pozdrav ${targetUserName.trim()}!` : 'Pozdrav!';
    const text = `${greeting} Tvoj aktivacijski ključ za RiboPrognoza aplikaciju (uređaj: ${targetDeviceId}):\n\n${generatedKey}\n\nUnesi ga u aplikaciju za trajno otključavanje.`;
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

  const handleToggleLicenseStatus = async (item: LicenseRecord) => {
    const newStatus = item.status === 'active' ? 'revoked' : 'active';
    try {
      await updateAdminLicense(pinInput || '2026', {
        deviceId: item.deviceId,
        status: newStatus
      });
      setLicenses(prev => prev.map(l => l.deviceId === item.deviceId ? { ...l, status: newStatus } : l));
      setActionSuccessMsg(newStatus === 'revoked' ? `Licenca za ${item.userName} je UKINUTA.` : `Licenca za ${item.userName} je ponovno AKTIVIRANA.`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (err: any) {
      alert('Greška pri izmjeni statusa: ' + err.message);
    }
  };

  const handleStartEditingName = (item: LicenseRecord) => {
    setEditingDeviceId(item.deviceId);
    setEditingNameValue(item.userName);
  };

  const handleSaveName = async (deviceId: string) => {
    if (!editingNameValue.trim()) return;
    try {
      await updateAdminLicense(pinInput || '2026', {
        deviceId,
        userName: editingNameValue.trim()
      });
      setLicenses(prev => prev.map(l => l.deviceId === deviceId ? { ...l, userName: editingNameValue.trim() } : l));
      setEditingDeviceId(null);
      setActionSuccessMsg(`Ime korisnika uspješno promijenjeno u: ${editingNameValue.trim()}`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (err: any) {
      alert('Greška pri spremanju imena: ' + err.message);
    }
  };

  const handleDeleteLicense = async (deviceId: string, userName: string) => {
    if (!window.confirm(`Sigurno želite obrisati licencu za "${userName}" (${deviceId})?`)) return;
    try {
      await deleteAdminLicense(pinInput || '2026', deviceId);
      setLicenses(prev => prev.filter(l => l.deviceId !== deviceId));
      setActionSuccessMsg(`Licenca za ${userName} je obrisana.`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (err: any) {
      alert('Greška pri brisanju licence: ' + err.message);
    }
  };

  const handleToggleChatPermission = async (item: LicenseRecord) => {
    const nextChatEnabled = item.chatEnabled === false;
    try {
      await updateAdminLicense(pinInput || '2026', {
        deviceId: item.deviceId,
        chatEnabled: nextChatEnabled
      });
      setLicenses(prev => prev.map(l => l.deviceId === item.deviceId ? { ...l, chatEnabled: nextChatEnabled } : l));
      setActionSuccessMsg(nextChatEnabled ? `LiveChat je ODOBREN za: ${item.userName}` : `LiveChat je BLOKIRAN za: ${item.userName}`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (err: any) {
      alert('Greška pri izmjeni prava za LiveChat: ' + err.message);
    }
  };

  const handleAddNewUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) {
      alert('Molimo unesite ID uređaja (npr. RP-8B3E-72C9).');
      return;
    }
    setIsAddingUser(true);
    try {
      const cleanId = newUserId.trim().toUpperCase();
      const finalKey = newUserKey.trim().toUpperCase() || generateActivationKey(cleanId);
      const cleanName = newUserName.trim() || `Ribič (${cleanId.slice(-4)})`;

      await addAdminLicense(pinInput || '2026', {
        deviceId: cleanId,
        userName: cleanName,
        activationKey: finalKey,
        chatEnabled: newUserChatEnabled,
        status: newUserStatus,
        notes: newUserNotes.trim()
      });

      await loadLicensesData();
      setShowAddUserForm(false);
      setNewUserId('');
      setNewUserName('');
      setNewUserKey('');
      setNewUserNotes('');
      setNewUserChatEnabled(true);
      setNewUserStatus('active');
      setActionSuccessMsg(`Korisnik ${cleanName} je uspješno dodan/ažuriran sa statusom: ${newUserChatEnabled ? 'Chat odobren' : 'Chat blokiran'}!`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
    } catch (err: any) {
      alert('Greška pri spremanju korisnika: ' + err.message);
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteChatMessage = async (msgId: string) => {
    if (!window.confirm('Želite li obrisati ovu poruku iz chata?')) return;
    try {
      await deleteChatMessageAsAdmin(pinInput || '2026', msgId);
      setChatMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err: any) {
      alert('Greška pri brisanju poruke: ' + err.message);
    }
  };

  const handleRunDiagnostic = async () => {
    setIsDiagnosing(true);
    setDiagnosticResult(null);
    try {
      const res = await runUpdateDiagnostic();
      setDiagnosticResult(res);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const filteredLicenses = licenses.filter(l => 
    l.userName.toLowerCase().includes(licenseSearchQuery.toLowerCase()) ||
    l.deviceId.toLowerCase().includes(licenseSearchQuery.toLowerCase()) ||
    l.activationKey.toLowerCase().includes(licenseSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md select-none animate-fadeIn">
      <div className={`bg-slate-900 border border-amber-500/40 rounded-3xl p-4 sm:p-6 w-full ${isAuthenticated ? 'max-w-3xl' : 'max-w-md'} shadow-2xl relative text-white max-h-[90vh] overflow-y-auto transition-all`}>
        
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
            <h2 className="text-base sm:text-lg font-black text-white leading-tight">
              Kontrolni Panel & Licence
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
          /* Korak 2: Admin sučelje s 4 taba */
          <div className="space-y-4">
            
            {/* Tabovi */}
            <div className="flex border-b border-slate-800 gap-1 overflow-x-auto pb-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('korisnici')}
                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'korisnici'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Korisnici & Opoziv</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-amber-300">
                  {licenses.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('generator')}
                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'generator'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Generator Koda</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'chat'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Nadzor Chata</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-cyan-300">
                  {chatMessages.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('azuriranja')}
                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'azuriranja'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>Ažuriranja</span>
              </button>
            </div>

            {/* Obavijest o uspješnoj akciji */}
            {actionSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{actionSuccessMsg}</span>
              </div>
            )}

            {/* TAB 1: KORISNICI I OPOZIV LICENCI */}
            {activeTab === 'korisnici' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={licenseSearchQuery}
                      onChange={(e) => setLicenseSearchQuery(e.target.value)}
                      placeholder="Pretraži po imenu, ID-u ili ključu..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddUserForm(!showAddUserForm)}
                    className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                    title="Ručni unos postojećeg ili novog korisnika"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{showAddUserForm ? 'Zatvori unos' : '+ Dodaj korisnika'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={loadLicensesData}
                    disabled={isLoadingLicenses}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="Osvježi listu"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLicenses ? 'animate-spin' : ''}`} />
                    <span>Osvježi</span>
                  </button>
                </div>

                {/* Forma za ručno dodavanje postojećeg ili novog korisnika */}
                {showAddUserForm && (
                  <form onSubmit={handleAddNewUserSubmit} className="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border border-teal-500/50 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-teal-400" />
                        <h3 className="text-xs sm:text-sm font-bold text-white">
                          Dodavanje postojećeg ili novog korisnika u bazu & chat
                        </h3>
                      </div>
                      <span className="text-[10px] text-teal-400 font-mono bg-teal-950/80 px-2 py-0.5 rounded-md border border-teal-800/60">
                        Admin unos
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">
                          ID uređaja (Device ID) <span className="text-rose-400">*</span>:
                        </label>
                        <input
                          type="text"
                          value={newUserId}
                          onChange={(e) => setNewUserId(e.target.value)}
                          placeholder="npr. RP-8B3E-72C9"
                          required
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-teal-400"
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Jedinstveni ID uređaja korisnika (prikazan na dnu aplikacije)
                        </p>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">
                          Ime korisnika / Ribiča:
                        </label>
                        <input
                          type="text"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="npr. Marko - Aljmaš"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-400"
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Ovo ime će se prikazivati u kontrolnom panelu i LiveChatu
                        </p>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">
                          Aktivacijski kod (opcionalno):
                        </label>
                        <input
                          type="text"
                          value={newUserKey}
                          onChange={(e) => setNewUserKey(e.target.value)}
                          placeholder="Automatski se računa ako je prazno"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-teal-400"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">
                          Status licence:
                        </label>
                        <select
                          value={newUserStatus}
                          onChange={(e) => setNewUserStatus(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-400 cursor-pointer"
                        >
                          <option value="active">🟢 Aktivna licenca (odobren rad)</option>
                          <option value="revoked">🔴 Ukinuta licenca (blokiran rad)</option>
                        </select>
                      </div>
                    </div>

                    {/* Prekidač za LiveChat dozvolu */}
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-white block">
                          Pristup internom LiveChatu
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Dozvoli ovom korisniku pregled i slanje poruka na vodi
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewUserChatEnabled(!newUserChatEnabled)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                          newUserChatEnabled
                            ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm'
                            : 'bg-rose-950 border-rose-700 text-rose-300'
                        }`}
                      >
                        {newUserChatEnabled ? '✓ Chat: ODOBREN' : '✕ Chat: BLOKIRAN'}
                      </button>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={newUserNotes}
                        onChange={(e) => setNewUserNotes(e.target.value)}
                        placeholder="Interna bilješka (opcionalno)..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddUserForm(false)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer hover:bg-slate-700"
                      >
                        Odustani
                      </button>
                      <button
                        type="submit"
                        disabled={isAddingUser}
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs cursor-pointer shadow-md flex items-center gap-1.5"
                      >
                        {isAddingUser ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Spremi korisnika u sustav & chat</span>
                      </button>
                    </div>
                  </form>
                )}

                {isLoadingLicenses && licenses.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                    <span>Učitavanje registriranih korisnika...</span>
                  </div>
                ) : filteredLicenses.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-950/60 rounded-2xl border border-slate-800">
                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-300">Nema registriranih korisnika</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Kliknite gore na "+ Dodaj korisnika" za ručni unos postojećeg ribiča, ili kada korisnik aktivira aplikaciju ključem, automatski će se pojaviti ovdje.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {filteredLicenses.map((lic) => {
                      const isRevoked = lic.status === 'revoked';
                      const isEditing = editingDeviceId === lic.deviceId;

                      return (
                        <div 
                          key={lic.deviceId} 
                          className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isRevoked 
                              ? 'bg-rose-950/20 border-rose-900/50' 
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            {/* Ime korisnika */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                                  <input
                                    type="text"
                                    value={editingNameValue}
                                    onChange={(e) => setEditingNameValue(e.target.value)}
                                    className="bg-slate-900 border border-amber-400 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                                    placeholder="Ime i prezime..."
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveName(lic.deviceId)}
                                    className="px-2 py-1 rounded bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
                                  >
                                    Spremi
                                  </button>
                                  <button
                                    onClick={() => setEditingDeviceId(null)}
                                    className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-xs cursor-pointer"
                                  >
                                    Odustani
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-white text-sm">
                                    {lic.userName}
                                  </span>
                                  <button
                                    onClick={() => handleStartEditingName(lic)}
                                    className="text-slate-400 hover:text-amber-300 p-0.5 cursor-pointer"
                                    title="Uredi ime korisnika"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {/* Status licence bedž */}
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isRevoked 
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}>
                                {isRevoked ? 'Ukinuta' : 'Aktivna'}
                              </span>

                              {/* LiveChat status & brzi toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleChatPermission(lic)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 cursor-pointer border transition-all ${
                                  lic.chatEnabled !== false
                                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-500/60'
                                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-teal-950/80 hover:text-teal-300 hover:border-teal-500/60'
                                }`}
                                title={lic.chatEnabled !== false ? 'Klikni za blokiranje chata ovom korisniku' : 'Klikni za odobrenje chata ovom korisniku'}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${lic.chatEnabled !== false ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                <span>{lic.chatEnabled !== false ? 'Chat: Odobren' : 'Chat: Blokiran'}</span>
                              </button>
                            </div>

                            {/* ID uređaja i ključ */}
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap font-mono">
                              <span>ID: <strong className="text-slate-200">{lic.deviceId}</strong></span>
                              <span>Ključ: <strong className="text-amber-300">{lic.activationKey}</strong></span>
                            </div>
                          </div>

                          {/* Akcijski gumbi */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleToggleLicenseStatus(lic)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                                isRevoked
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                  : 'bg-rose-950 hover:bg-rose-900 border border-rose-700/60 text-rose-300'
                              }`}
                              title={isRevoked ? 'Vrati aktivaciju' : 'Ukini valjanost licence'}
                            >
                              {isRevoked ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Aktiviraj</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Ukini licencu</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleDeleteLicense(lic.deviceId, lic.userName)}
                              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-rose-400 border border-slate-800 cursor-pointer transition-colors"
                              title="Obriši iz baze"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: GENERATOR KLJUČEVA */}
            {activeTab === 'generator' && (
              <div className="space-y-4">
                <form onSubmit={handleGenerate} className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-300 font-bold mb-1">
                      1. Ime i prezime / Nadimak korisnika (za interni chat):
                    </label>
                    <input
                      type="text"
                      value={targetUserName}
                      onChange={(e) => setTargetUserName(e.target.value)}
                      placeholder="npr. Pero - Aljmaš ili Mario Vinkovci"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-bold mb-1">
                      2. Unesite ID uređaja kupca/korisnika:
                    </label>
                    <input
                      type="text"
                      value={targetDeviceId}
                      onChange={(e) => setTargetDeviceId(e.target.value.toUpperCase())}
                      placeholder="npr. RP-8B3E-72C9"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono tracking-wider text-amber-300 placeholder-slate-500 focus:outline-none focus:border-amber-400 uppercase"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Izračunaj Aktivacijski Kod</span>
                  </button>
                </form>

                {generatedKey && (
                  <div className="p-3.5 bg-slate-950 border border-amber-500/40 rounded-2xl space-y-2.5 animate-fadeIn">
                    <span className="text-[11px] text-slate-400 block font-bold">
                      Generirani aktivacijski kod za uređaj {targetDeviceId}:
                    </span>
                    <div className="text-xl font-mono font-black text-amber-400 text-center tracking-widest bg-slate-900 py-2 rounded-xl border border-slate-800">
                      {generatedKey}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCopyKey}
                        className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey ? 'Kopirano!' : 'Kopiraj kod'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleShareKey}
                        className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Podijeli korisniku</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: NADZOR CHATA */}
            {activeTab === 'chat' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400 font-bold">
                    Zadnje poruke u internom chatu ribiča:
                  </span>
                  <button
                    onClick={loadChatData}
                    disabled={isLoadingChat}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingChat ? 'animate-spin' : ''}`} />
                    <span>Osvježi</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {chatMessages.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Nema poruka u chatu.
                    </div>
                  ) : (
                    chatMessages.slice().reverse().map((msg) => (
                      <div key={msg.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-cyan-300">{msg.userName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({msg.deviceId})</span>
                            <span className="text-[10px] text-slate-400 font-mono ml-auto">{msg.timestamp}</span>
                          </div>
                          <p className="text-slate-200 break-words">{msg.text}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {msg.deviceId !== 'RP-ADMIN' && (
                            <button
                              type="button"
                              onClick={() => {
                                const found = licenses.find(l => l.deviceId === msg.deviceId);
                                if (found) {
                                  handleToggleChatPermission(found);
                                } else {
                                  updateAdminLicense(pinInput || '2026', {
                                    deviceId: msg.deviceId,
                                    userName: msg.userName,
                                    chatEnabled: false
                                  }).then(() => {
                                    loadLicensesData();
                                    setActionSuccessMsg(`LiveChat je BLOKIRAN za: ${msg.userName}`);
                                    setTimeout(() => setActionSuccessMsg(null), 3000);
                                  });
                                }
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-[10px] text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
                              title="Brzo blokiranje chata za ovog korisnika"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Blokiraj chat</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteChatMessage(msg.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                            title="Obriši poruku"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: AŽURIRANJA I APK */}
            {activeTab === 'azuriranja' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <label className="block text-xs text-slate-300 font-bold">
                    GitHub repozitorij za APK ažuriranja:
                  </label>
                  <input
                    type="text"
                    value={githubRepoInput}
                    onChange={(e) => setGithubRepoInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSavedGithubRepo(githubRepoInput.trim());
                      setRepoSavedMsg(true);
                      setTimeout(() => setRepoSavedMsg(false), 2500);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer"
                  >
                    {repoSavedMsg ? 'Spremljeno!' : 'Spremi repozitorij'}
                  </button>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-300 font-bold block">
                    Dijagnostika & Testiranje skočnog prozora:
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleRunDiagnostic}
                      disabled={isDiagnosing}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      {isDiagnosing ? 'Testiranje...' : 'Pokreni dijagnostiku'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onTestUpdatePopup && onTestUpdatePopup({
                        version: '1.3.1',
                        name: 'RiboPrognoza',
                        releaseDate: '2026-10-30',
                        apkUrl: 'https://github.com/dxdandy/Android-App-Repo/releases/latest/download/RiboPrognoza.apk',
                        changelog: ['Testiranje skočnog prozora nadogradnje'],
                        isCritical: false
                      })}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer"
                    >
                      Testiraj Popup
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
