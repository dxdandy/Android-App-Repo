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
  AlertCircle
} from 'lucide-react';
import { fetchChatMessages, sendChatMessage, ChatMessage } from '../services/chatService';
import { getDeviceId, getUserName } from '../services/licenseService';

interface FishingChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_EMOJIS = ['🎣', '🐟', '🦈', '🌊', '☀️', '🌧️', '⛵', '⚓', '👍', '🔥', '🍻', '☕'];

export const FishingChatModal: React.FC<FishingChatModalProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const myDeviceId = getDeviceId();
  const myUserName = getUserName();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    const list = await fetchChatMessages();
    setMessages(list);
  };

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    loadMessages().finally(() => {
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);
    });

    // Polling za nove poruke svakih 3.5 sekunde dok je modal otvoren
    const interval = setInterval(() => {
      loadMessages();
    }, 3500);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Pomak na dno kada se promijeni broj poruka
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages.length, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    setErrorMessage(null);

    const res = await sendChatMessage(inputText.trim());
    setIsSending(false);

    if (res.success && res.message) {
      setMessages(prev => [...prev, res.message!]);
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
                  Dunavski Ribički Chat
                </h2>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Uživo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Prijavljeni ste kao: <span className="font-bold text-teal-300">{myUserName}</span>
              </p>
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

        {/* Prozor s porukama */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-slate-950/40">
          {isLoading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-teal-400" />
              <span>Učitavanje poruka s vode...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
              <div className="text-3xl mb-2">🎣</div>
              <p className="text-xs font-semibold text-slate-300">Još nema poruka u chatu</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                Budite prvi koji će javiti kakvo je stanje vodostaja ili griz na Dunavu!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.deviceId === myDeviceId;

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

                  {/* Oblačić poruke */}
                  <div className={`p-2.5 sm:p-3 rounded-2xl text-xs sm:text-sm break-words leading-relaxed shadow-sm ${
                    isMine 
                      ? 'bg-gradient-to-br from-teal-600 to-cyan-700 text-white rounded-tr-xs border border-teal-400/30' 
                      : 'bg-slate-800/90 text-slate-100 rounded-tl-xs border border-slate-700/80'
                  }`}>
                    {msg.text}
                  </div>

                  {/* Vrijeme slanja */}
                  <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-0.5 px-1 font-mono">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{msg.timestamp}</span>
                    {isMine && <CheckCheck className="w-3 h-3 text-teal-400 ml-0.5" />}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

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

        {/* Unos teksta i gumb za slanje */}
        <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800/80 flex items-center gap-2 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
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

      </div>
    </div>
  );
};
