import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  X, 
  RefreshCw, 
  Smile, 
  User, 
  Clock, 
  CheckCheck,
  AlertCircle,
  Edit2,
  Check,
  Eye
} from 'lucide-react';
import { 
  fetchChatMessages, 
  sendChatMessage, 
  subscribeToChatMessages,
  subscribeToTypingStatus,
  setMyTypingStatus,
  TypingUser,
  ChatMessage, 
  markChatAsRead, 
  renameMyUserName 
} from '../services/chatService';
import { getDeviceId, getUserName } from '../services/licenseService';
import { playNotificationSound } from '../services/notificationService';

interface FishingChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNameChanged?: (newName: string) => void;
}

const QUICK_EMOJIS = ['🎣', '🐟', '🦈', '🌊', '☀️', '🌧️', '⛵', '⚓', '👍', '🔥', '🍻', '☕'];

export const FishingChatModal: React.FC<FishingChatModalProps> = ({ isOpen, onClose, onNameChanged }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  // Stanje tko trenutno tipka u chatu
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [dotCount, setDotCount] = useState<number>(1);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stanje za pregled tko je pročitao poruku (dostupno svima klikom na poruku)
  const [selectedMessageForInfo, setSelectedMessageForInfo] = useState<ChatMessage | null>(null);

  // Stanja za promjenu vlastitog imena u chatu
  const [myUserName, setMyUserName] = useState<string>(() => getUserName());
  const [isEditingMyName, setIsEditingMyName] = useState(false);
  const [newMyNameInput, setNewMyNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const myDeviceId = getDeviceId();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Ciklus animacije 3 točkice za status tipkanja: 1 točka -> 2 točke -> 3 točke -> ugašeno sve 3 -> ispočetka
  useEffect(() => {
    if (typingUsers.length === 0) return;
    const dotInterval = setInterval(() => {
      setDotCount(prev => (prev >= 3 ? 0 : prev + 1));
    }, 450);
    return () => clearInterval(dotInterval);
  }, [typingUsers.length]);

  // Pretplata na poruke i status tipkanja u stvarnom vremenu preko Firestorea
  useEffect(() => {
    if (!isOpen) {
      setMyTypingStatus(false).catch(() => {});
      return;
    }

    setIsLoading(true);
    let initialLoaded = false;

    // 1. Pretplata na poruke
    const unsubscribeChat = subscribeToChatMessages((res) => {
      setIsLoading(false);
      if (res.chatBlocked) {
        setIsBlocked(true);
        setBlockedReason(res.message || 'Pristup LiveChatu je onemogućen.');
        setMessages([]);
      } else {
        setIsBlocked(false);
        setBlockedReason(null);
        setMessages(prev => {
          // Ako je stigla nova poruka od nekog drugog dok gledamo chat, oglasi se zvučni ton
          if (initialLoaded && prev.length > 0 && res.messages.length > prev.length) {
            const newest = res.messages[res.messages.length - 1];
            if (newest && newest.deviceId !== myDeviceId) {
              playNotificationSound();
            }
          }
          return res.messages;
        });

        // Ažuriraj modal tko je pročitao poruku ako je otvoren
        setSelectedMessageForInfo(prevSelected => {
          if (!prevSelected) return null;
          return res.messages.find(m => m.id === prevSelected.id) || prevSelected;
        });

        // Označi poruke pročitanima
        markChatAsRead(res.messages);
      }
      initialLoaded = true;
      setTimeout(scrollToBottom, 80);
    });

    // 2. Pretplata na aktivno tipkanje drugih korisnika
    const unsubscribeTyping = subscribeToTypingStatus((activeTypers) => {
      setTypingUsers(activeTypers);
    });

    return () => {
      unsubscribeChat();
      unsubscribeTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setMyTypingStatus(false).catch(() => {});
    };
  }, [isOpen]);

  // Pomak na dno kada se promijeni broj poruka ili netko počne tipkati
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages.length, typingUsers.length, isOpen]);

  const handleSaveMyName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMyNameInput.trim() || isSavingName) return;

    setIsSavingName(true);
    setErrorMessage(null);
    try {
      const res = await renameMyUserName(newMyNameInput.trim());
      if (res.success) {
        setMyUserName(res.userName);
        setIsEditingMyName(false);
        if (onNameChanged) onNameChanged(res.userName);
      } else {
        setErrorMessage(res.error || 'Neuspješna promjena imena.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Greška pri promjeni imena.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!isBlocked) {
      if (val.trim().length > 0) {
        setMyTypingStatus(true).catch(() => {});
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setMyTypingStatus(false).catch(() => {});
        }, 3500);
      } else {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setMyTypingStatus(false).catch(() => {});
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setMyTypingStatus(false).catch(() => {});

    setIsSending(true);
    setErrorMessage(null);

    const res = await sendChatMessage(inputText.trim());
    setIsSending(false);

    if (res.success && res.message) {
      setInputText('');
      setTimeout(scrollToBottom, 50);
      inputRef.current?.focus();
    } else {
      setErrorMessage(res.error || 'Slanje poruke nije uspjelo.');
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    inputRef.current?.focus();
    if (!isBlocked) {
      setMyTypingStatus(true).catch(() => {});
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setMyTypingStatus(false).catch(() => {});
      }, 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md select-none animate-fadeIn">
      <div className="bg-slate-900 border border-teal-500/40 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col h-[85vh] max-h-[640px] text-white relative overflow-hidden">
        
        {/* Pozadinski svjetlosni ukras */}
        <div className="absolute -right-20 -top-20 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Zaglavlje Chata */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  Dunavski Ribički LiveChat
                </h2>
                {!isBlocked && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                )}
              </div>
              {isEditingMyName ? (
                <form onSubmit={handleSaveMyName} className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="text"
                    value={newMyNameInput}
                    onChange={(e) => setNewMyNameInput(e.target.value)}
                    placeholder="Novo ime..."
                    autoFocus
                    maxLength={28}
                    className="bg-slate-900 border border-teal-500 rounded-lg px-2 py-0.5 text-[11px] text-white focus:outline-none w-28 sm:w-36"
                  />
                  <button
                    type="submit"
                    disabled={isSavingName || !newMyNameInput.trim()}
                    className="px-2 py-0.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-[10px] cursor-pointer flex items-center gap-1 shrink-0"
                    title="Spremi novo ime"
                  >
                    {isSavingName ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                    <span>Spremi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingMyName(false)}
                    className="px-1.5 py-0.5 rounded-lg bg-slate-800 text-slate-400 text-[10px] cursor-pointer hover:text-white"
                  >
                    Odustani
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] text-slate-400 truncate">
                    Prijavljeni: <span className="font-bold text-teal-300">{myUserName}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewMyNameInput(myUserName);
                      setIsEditingMyName(true);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-teal-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
                    title="Promijeni vlastito ime u chatu"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 border border-slate-700/60"
            title="Zatvori chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prozor s porukama ili prikaz blokiranog statusa */}
        {isBlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950/70">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="max-w-xs space-y-1.5">
              <h3 className="text-base font-black text-white">LiveChat nije odobren</h3>
              <p className="text-xs text-rose-300 font-semibold">
                {blockedReason || 'Administrator vam je onemogućio pristup LiveChatu.'}
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                Poruke u LiveChatu mogu pratiti i pisati isključivo korisnici kojima je administrator dodijelio odobrenje. Za pristup se obratite Danielu.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-slate-950/40">
            {isLoading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-teal-400" />
                <span>Učitavanje poruka s vode...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
                <div className="text-3xl mb-2">🎣</div>
                <p className="text-xs font-semibold text-slate-300">Još nema poruka u LiveChatu</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                  Budite prvi koji će javiti kakvo je stanje vodostaja ili griz na Dunavu!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.deviceId === myDeviceId;
                const readCount = msg.readBy?.length || 0;

                return (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[85%] ${isMine ? 'ml-auto' : 'mr-auto'}`}
                  >
                    {/* Ime pošiljatelja */}
                    <span className={`text-[10px] font-bold mb-0.5 px-1 ${
                      isMine ? 'text-teal-300' : 'text-cyan-300'
                    }`}>
                      {msg.userName} {isMine && '(Vi)'}
                    </span>

                    {/* Oblačić poruke - klikom na njega svima se otvara tko je pročitao */}
                    <button
                      type="button"
                      onClick={() => setSelectedMessageForInfo(msg)}
                      className={`text-left p-2.5 sm:p-3 rounded-2xl text-xs sm:text-sm break-words leading-relaxed shadow-sm cursor-pointer hover:brightness-110 active:scale-[0.99] transition-all group relative border ${
                        isMine 
                          ? 'bg-gradient-to-br from-teal-600 to-cyan-700 text-white rounded-tr-xs border-teal-400/40' 
                          : 'bg-slate-800/95 text-slate-100 rounded-tl-xs border-slate-700/80 hover:border-slate-600'
                      }`}
                      title="Klikni za prikaz tko je sve pročitao ovu poruku"
                    >
                      <span>{msg.text}</span>
                    </button>

                    {/* Vrijeme slanja, kvačice i status tko je pročitao (svima vidljivo i klikabilno) */}
                    <button
                      type="button"
                      onClick={() => setSelectedMessageForInfo(msg)}
                      className="flex items-center gap-1.5 text-[9px] text-slate-400 hover:text-cyan-300 mt-0.5 px-1 font-mono transition-colors cursor-pointer"
                      title="Klikni za prikaz tko je sve pročitao ovu poruku"
                    >
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{msg.timestamp}</span>
                      </span>

                      {/* Prikaz kvačica i brojača pregleda */}
                      {readCount > 0 ? (
                        <span className="flex items-center gap-1 text-cyan-300 font-bold bg-cyan-950/70 hover:bg-cyan-900/80 px-1.5 py-0.5 rounded-md border border-cyan-700/60 transition-colors">
                          <CheckCheck className="w-3 h-3 text-cyan-400 shrink-0" />
                          <Eye className="w-2.5 h-2.5 text-cyan-300 shrink-0" />
                          <span>{readCount}</span>
                        </span>
                      ) : isMine ? (
                        <span className="flex items-center gap-0.5 text-slate-500">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : null}
                    </button>
                  </div>
                );
              })
            )}
            
            {/* Indikator kada drugi korisnik tipka: [Ime] nešto piše ... (tri točkice koje se pale redom 1, 2, 3 pa ugase sve tri i ispočetka) */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-800/95 border border-teal-500/40 text-xs text-teal-300 w-fit max-w-[90%] shadow-lg animate-fadeIn select-none">
                <div className="w-5 h-5 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                  <User className="w-3 h-3" />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-white">
                    {typingUsers.map(u => u.userName).join(', ')}
                  </span>
                  <span className="text-slate-300">nešto piše</span>
                  <span className="inline-flex items-center gap-0.5 font-black text-sm tracking-widest text-teal-400 select-none">
                    <span className={`inline-block w-1.5 text-center transition-opacity duration-150 ${dotCount >= 1 ? 'opacity-100 text-teal-300 font-extrabold' : 'opacity-0'}`}>.</span>
                    <span className={`inline-block w-1.5 text-center transition-opacity duration-150 ${dotCount >= 2 ? 'opacity-100 text-teal-300 font-extrabold' : 'opacity-0'}`}>.</span>
                    <span className={`inline-block w-1.5 text-center transition-opacity duration-150 ${dotCount >= 3 ? 'opacity-100 text-teal-300 font-extrabold' : 'opacity-0'}`}>.</span>
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Greška kod slanja */}
        {errorMessage && (
          <div className="px-3 py-1.5 bg-rose-950/80 border-t border-rose-800/60 text-rose-300 text-[11px] flex items-center justify-between gap-2 shrink-0">
            <span className="flex items-center gap-1.5 truncate">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              {errorMessage}
            </span>
            <button 
              onClick={() => setErrorMessage(null)} 
              className="text-rose-400 hover:text-white text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Brza traka s ribičkim emotikonima */}
        {!isBlocked && (
          <div className="px-3 py-1.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <Smile className="w-3 h-3 text-amber-400" />
            </span>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleAddEmoji(emoji)}
                className="w-7 h-7 flex items-center justify-center text-sm rounded-lg hover:bg-slate-800 active:scale-90 transition-transform cursor-pointer shrink-0"
                title={`Dodaj ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Unos teksta i gumb za slanje */}
        {!isBlocked && (
          <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800/80 flex items-center gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Napiši poruku s Dunava..."
              maxLength={350}
              className="flex-1 bg-slate-900 border border-slate-700/80 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-all"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Pošalji poruku"
            >
              {isSending ? (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <>
                  <span className="hidden sm:inline">Pošalji</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}
        {/* Modal s detaljima: Tko je sve pročitao poruku (dostupno svima klikom na bilo koju poruku) */}
        {selectedMessageForInfo && (
          <div 
            onClick={() => setSelectedMessageForInfo(null)}
            className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-sm p-4 flex flex-col justify-center items-center animate-fadeIn select-text"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-slate-900 border border-teal-500/50 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Tko je pročitao poruku</h3>
                    <p className="text-[10px] text-teal-300 font-semibold">
                      {selectedMessageForInfo.readBy && selectedMessageForInfo.readBy.length > 0
                        ? `${selectedMessageForInfo.readBy.length} ${selectedMessageForInfo.readBy.length === 1 ? 'osoba pročitala' : 'osoba pročitalo'}`
                        : 'Još nitko nije pročitao'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMessageForInfo(null)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sažetak pregledavane poruke */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <p className="text-slate-200 break-words leading-relaxed">
                  "{selectedMessageForInfo.text}"
                </p>
                <div className="pt-1 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Poslao: <strong className="text-teal-300">{selectedMessageForInfo.userName}</strong></span>
                  <span>{selectedMessageForInfo.timestamp} h</span>
                </div>
              </div>

              {/* Popis korisnika koji su pročitali poruku */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Popis čitatelja:
                </div>
                {selectedMessageForInfo.readBy && selectedMessageForInfo.readBy.length > 0 ? (
                  selectedMessageForInfo.readBy.map((reader, idx) => (
                    <div 
                      key={reader.deviceId + '-' + idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-white text-xs truncate">{reader.userName}</span>
                      </div>
                      <span className="text-[10px] text-teal-300 font-mono shrink-0 pl-2">
                        {new Date(reader.readAt).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })} h
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-400 space-y-1">
                    <Check className="w-5 h-5 mx-auto text-slate-600" />
                    <p className="font-semibold text-slate-300">Nema evidentiranih pregleda</p>
                    <p className="text-[10px] text-slate-500">Čim netko otvori LiveChat, ovdje će se pojaviti njegovo ime i vrijeme čitanja.</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedMessageForInfo(null)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-slate-950 font-black text-xs cursor-pointer shadow-md transition-all active:scale-95"
              >
                Zatvori pregled
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
