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
  Eye, 
  CheckCircle2, 
  Lock,
  Calendar,
  Trash2,
  AlertTriangle,
  CornerUpLeft,
  ChevronLeft
} from 'lucide-react';
import { 
  fetchChatMessages, 
  sendChatMessage, 
  subscribeToChatMessages, 
  subscribeToTypingStatus, 
  setMyTypingStatus, 
  TypingUser, 
  ChatMessage, 
  ChatReplyTo,
  markChatAsRead, 
  renameMyUserName, 
  renameUserAsAdmin, 
  clearAllChatHistoryAsAdmin,
  isAdminUnlocked, 
  setAdminUnlocked 
} from '../services/chatService';
import { getDeviceId, getUserName } from '../services/licenseService';
import { playNotificationSound } from '../services/notificationService';

interface FishingChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNameChanged?: (newName: string) => void;
}

const QUICK_EMOJIS = ['🎣', '🐟', '🦈', '🌊', '☀️', '🌧️', '⛵', '⚓', '👍', '🔥', '🍻', '☕'];

interface SwipeableMessageRowProps {
  msg: ChatMessage;
  isMine: boolean;
  readCount: number;
  onOpenRename: (deviceId: string, userName: string) => void;
  onShowInfo: (msg: ChatMessage) => void;
  onReply: (msg: ChatMessage) => void;
}

const SwipeableMessageRow: React.FC<SwipeableMessageRowProps> = ({
  msg,
  isMine,
  readCount,
  onOpenRename,
  onShowInfo,
  onReply
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);
  const hasTriggeredHapticRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    hasTriggeredHapticRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    if (isHorizontalRef.current === null) {
      if (Math.abs(diffX) > 8 && Math.abs(diffX) > Math.abs(diffY)) {
        isHorizontalRef.current = true;
        setIsSwiping(true);
      } else if (Math.abs(diffY) > 8) {
        isHorizontalRef.current = false;
      }
    }

    if (isHorizontalRef.current === true) {
      // Clamped horizontal offset (podržava povlačenje i ulijevo i udesno!)
      const offset = diffX > 0 ? Math.min(diffX * 0.7, 85) : Math.max(diffX * 0.7, -85);
      setSwipeOffset(offset);

      if (Math.abs(offset) >= 42 && !hasTriggeredHapticRef.current) {
        hasTriggeredHapticRef.current = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(18); } catch {}
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (Math.abs(swipeOffset) >= 40) {
      onReply(msg);
    }
    setSwipeOffset(0);
    setIsSwiping(false);
    isHorizontalRef.current = null;
  };

  const isTriggered = Math.abs(swipeOffset) >= 40;

  return (
    <div className="relative overflow-visible my-1 select-none w-full">
      {/* Indikator ikone za replay/odgovor koji se pojavljuje kada se poruka povuče ulijevo ili udesno */}
      {swipeOffset !== 0 && (
        <div 
          className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center transition-all pointer-events-none z-10 ${
            swipeOffset > 0 ? 'left-2.5' : 'right-2.5'
          }`}
        >
          <div className={`p-2 rounded-full transition-transform flex items-center gap-1 ${
            isTriggered 
              ? 'bg-gradient-to-r from-teal-400 to-cyan-400 text-slate-950 scale-125 shadow-lg shadow-teal-500/50 font-black' 
              : 'bg-slate-800 text-teal-300 scale-95 opacity-80 border border-teal-500/30'
          }`}>
            <CornerUpLeft className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Tijelo poruke koje se glatko pomiče pri povlačenju lijevo/desno */}
      <div
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[90%] sm:max-w-[82%] ${isMine ? 'ml-auto' : 'mr-auto'} group/item`}
      >
        {/* Ime pošiljatelja */}
        <div className="flex items-center gap-1.5 mb-1 px-1">
          <button
            type="button"
            onClick={() => onOpenRename(msg.deviceId, msg.userName)}
            className={`text-xs sm:text-sm font-bold cursor-pointer hover:underline flex items-center gap-1 transition-colors ${
              isMine ? 'text-teal-300 hover:text-teal-200' : 'text-cyan-300 hover:text-cyan-200'
            }`}
            title="Klikni za izravnu promjenu imena ovog ribiča u LiveChatu"
          >
            <span>{msg.userName}</span>
            {isMine && <span className="text-[11px] opacity-75 font-normal">(Vi)</span>}
          </button>
          <button
            type="button"
            onClick={() => onOpenRename(msg.deviceId, msg.userName)}
            className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
            title={`Promijeni ime ribiča (${msg.userName})`}
          >
            <Edit2 className="w-3 h-3" />
          </button>
          {/* Brzi gumb za odgovor na poruku (jedan klik ili povlačenje) */}
          <button
            type="button"
            onClick={() => onReply(msg)}
            className="p-1 rounded text-slate-500 hover:text-teal-300 hover:bg-slate-800/80 transition-colors cursor-pointer opacity-70 group-hover/item:opacity-100 flex items-center gap-1 text-[11px]"
            title="Odgovori na ovu poruku (ili povuci lijevo/desno)"
          >
            <CornerUpLeft className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden sm:inline text-[10px] text-teal-400 font-semibold">Odgovori</span>
          </button>
        </div>

        {/* Oblačić poruke: fino podešena veličina (15px-17px) i smanjeni prored */}
        <div
          onClick={() => onShowInfo(msg)}
          className={`text-left p-3 sm:p-3.5 rounded-2xl break-words leading-snug sm:leading-normal shadow-md cursor-pointer hover:brightness-105 active:scale-[0.99] transition-all group relative border ${
            isMine 
              ? 'bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 text-white rounded-tr-xs border-teal-400/40 shadow-teal-950/30' 
              : 'bg-slate-800/95 text-slate-50 rounded-tl-xs border-slate-700 hover:border-slate-600 shadow-slate-950/40'
          }`}
          title="Klikni za prikaz tko je pročitao ovu poruku ili povuci za odgovor"
        >
          {/* Ako je poruka odgovor na raniju poruku (Replay pregled iznad teksta) */}
          {msg.replyTo && (
            <div className={`mb-2 p-2 rounded-xl text-left border-l-4 ${
              isMine 
                ? 'bg-slate-950/45 border-teal-300 text-teal-50' 
                : 'bg-slate-900/95 border-cyan-400 text-slate-200'
            }`}>
              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-300 mb-0.5">
                <CornerUpLeft className="w-3.5 h-3.5" />
                <span>Odgovor ribiču: {msg.replyTo.userName}</span>
              </div>
              <p className="line-clamp-2 text-xs sm:text-[13px] text-slate-300/95 italic">
                "{msg.replyTo.text}"
              </p>
            </div>
          )}

          {/* Glavni tekst poruke: smanjen za 10% (15px/17px) sa zbijenijim proredom (leading-snug sm:leading-normal) */}
          <span className="text-[15px] sm:text-[17px] leading-snug sm:leading-normal font-normal tracking-normal select-text">
            {msg.text}
          </span>
        </div>

        {/* Vrijeme slanja, kvačice i status pregleda */}
        <button
          type="button"
          onClick={() => onShowInfo(msg)}
          className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 hover:text-cyan-300 mt-1 px-1 font-mono transition-colors cursor-pointer"
          title="Klikni za prikaz tko je sve pročitao ovu poruku"
        >
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{msg.timestamp}</span>
          </span>

          {readCount > 0 ? (
            <span className="flex items-center gap-1.5 text-cyan-300 font-bold bg-cyan-950/80 hover:bg-cyan-900/90 px-2 py-0.5 rounded-lg border border-cyan-700/60 transition-colors">
              <CheckCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <Eye className="w-3 h-3 text-cyan-300 shrink-0" />
              <span>{readCount}</span>
            </span>
          ) : isMine ? (
            <span className="flex items-center gap-0.5 text-slate-500">
              <Check className="w-3.5 h-3.5" />
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
};

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

  // Stanja za administratorsku promjenu imena korisnika izravno u porukama
  const [isAdmin, setIsAdmin] = useState<boolean>(() => isAdminUnlocked());
  const [renameTarget, setRenameTarget] = useState<{ deviceId: string; userName: string } | null>(null);
  const [renameNewName, setRenameNewName] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSuccessToast, setRenameSuccessToast] = useState<string | null>(null);
  const [showPinPrompt, setShowPinPrompt] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<boolean>(false);
  const [pendingRenameTarget, setPendingRenameTarget] = useState<{ deviceId: string; userName: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<'rename' | 'clear' | null>(null);

  // Stanja za administratorsko brisanje cijele povijesti chata (Clear History)
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  const [isClearingChat, setIsClearingChat] = useState<boolean>(false);

  // Stanje za odgovor na poruku (Reply / Replay s citatom iznad)
  const [replyingTo, setReplyingTo] = useState<ChatReplyTo | null>(null);

  const handleSelectReply = (msg: ChatMessage) => {
    setReplyingTo({
      id: msg.id,
      userName: msg.userName,
      text: msg.text
    });
    inputRef.current?.focus();
  };

  const myDeviceId = getDeviceId();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Funkcija za lijep prikaz zaglavlja datuma između poruka
  const formatDateDivider = (timestamp?: number): string => {
    if (!timestamp) return 'Danas';
    const msgDate = new Date(Number(timestamp));
    if (isNaN(msgDate.getTime())) return 'Danas';
    const now = new Date();
    const isToday = msgDate.getFullYear() === now.getFullYear() &&
      msgDate.getMonth() === now.getMonth() &&
      msgDate.getDate() === now.getDate();
    if (isToday) return 'Danas';

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = msgDate.getFullYear() === yesterday.getFullYear() &&
      msgDate.getMonth() === yesterday.getMonth() &&
      msgDate.getDate() === yesterday.getDate();
    if (isYesterday) return 'Jučer';

    try {
      const formatted = msgDate.toLocaleDateString('hr-HR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return msgDate.toLocaleDateString('hr-HR');
    }
  };

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

    setIsAdmin(isAdminUnlocked());
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

  const handleOpenRenameUser = (targetDeviceId: string, currentUserName: string) => {
    if (isAdminUnlocked()) {
      setRenameTarget({ deviceId: targetDeviceId, userName: currentUserName });
      setRenameNewName(currentUserName);
      setRenameError(null);
    } else {
      setPendingAction('rename');
      setPendingRenameTarget({ deviceId: targetDeviceId, userName: currentUserName });
      setAdminPinInput('');
      setAdminPinError(false);
      setShowPinPrompt(true);
    }
  };

  const handleOpenClearChat = () => {
    if (isAdminUnlocked()) {
      setShowClearConfirmModal(true);
    } else {
      setPendingAction('clear');
      setAdminPinInput('');
      setAdminPinError(false);
      setShowPinPrompt(true);
    }
  };

  const handleAdminPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput.trim() === '2026') {
      setAdminUnlocked(true);
      setIsAdmin(true);
      setShowPinPrompt(false);
      setAdminPinError(false);

      if (pendingAction === 'clear') {
        setShowClearConfirmModal(true);
        setPendingAction(null);
      } else if (pendingRenameTarget) {
        setRenameTarget(pendingRenameTarget);
        setRenameNewName(pendingRenameTarget.userName);
        setRenameError(null);
        setPendingRenameTarget(null);
        setPendingAction(null);
      }
    } else {
      setAdminPinError(true);
    }
  };

  const handleConfirmClearChat = async () => {
    setIsClearingChat(true);
    try {
      const res = await clearAllChatHistoryAsAdmin('2026');
      if (res.success) {
        setMessages([]);
        setShowClearConfirmModal(false);
        setRenameSuccessToast('✓ Cjelokupna povijest LiveChata je obrisana za sve korisnike.');
        setTimeout(() => setRenameSuccessToast(null), 4000);
      } else {
        alert(res.error || 'Greška pri brisanju chata.');
      }
    } catch (err: any) {
      alert(err?.message || 'Greška pri brisanju povijesti chata.');
    } finally {
      setIsClearingChat(false);
    }
  };

  const handleConfirmRenameUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameNewName.trim() || isRenaming) return;

    setIsRenaming(true);
    setRenameError(null);
    try {
      const res = await renameUserAsAdmin(renameTarget.deviceId, renameNewName.trim());
      if (res.success) {
        setRenameSuccessToast(`✓ Ime ribiča uspješno promijenjeno u: ${res.newName}`);
        setTimeout(() => setRenameSuccessToast(null), 3500);

        if (renameTarget.deviceId === myDeviceId) {
          setMyUserName(res.newName);
          if (onNameChanged) onNameChanged(res.newName);
        }

        // Ažuriraj modal tko je pročitao ako je otvoren
        setSelectedMessageForInfo(prev => prev && prev.deviceId === renameTarget.deviceId ? { ...prev, userName: res.newName } : prev);
        setRenameTarget(null);
      } else {
        setRenameError(res.error || 'Promjena imena nije uspjela.');
      }
    } catch (err: any) {
      setRenameError(err.message || 'Greška pri promjeni imena.');
    } finally {
      setIsRenaming(false);
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

    const res = await sendChatMessage(inputText.trim(), replyingTo || undefined);
    setIsSending(false);

    if (res.success && res.message) {
      const sentMsg = res.message;
      setMessages(prev => {
        if (prev.some(m => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
      setInputText('');
      setReplyingTo(null);
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

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md select-none animate-fadeIn"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-teal-500/40 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col h-[85vh] max-h-[640px] text-white relative overflow-hidden"
      >
        
        {/* Pozadinski svjetlosni ukras */}
        <div className="absolute -right-20 -top-20 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Zaglavlje Chata */}
        <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {/* Gumb za povratak unatrag na Osnovni mod */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-teal-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-700/80 shrink-0 active:scale-95 shadow-sm"
              title="Povratak u Osnovni mod"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>

            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  Ribički LiveChat
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

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenClearChat}
                className="px-2.5 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 hover:border-rose-400 text-rose-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95"
                title="Obriši sve poruke u chatu za sve korisnike (Samo Administrator)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="hidden sm:inline">Obriši povijest chata</span>
                <span className="sm:hidden">Obriši</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 border border-slate-700/60"
              title="Zatvori chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Obavijest o uspješnoj promjeni imena */}
        {renameSuccessToast && (
          <div className="px-3.5 py-2 bg-emerald-950/90 border-b border-emerald-800/80 text-emerald-300 text-xs flex items-center justify-between gap-2 shrink-0 animate-fadeIn z-20">
            <span className="flex items-center gap-1.5 font-bold truncate">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              {renameSuccessToast}
            </span>
            <button 
              onClick={() => setRenameSuccessToast(null)} 
              className="text-emerald-400 hover:text-white text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

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
              messages.map((msg, idx) => {
                const isMine = msg.deviceId === myDeviceId;
                const readCount = msg.readBy?.length || 0;
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const showDateDivider = !prevMsg || 
                  new Date(msg.createdAt || 0).toDateString() !== new Date(prevMsg.createdAt || 0).toDateString();
                const dateLabel = formatDateDivider(msg.createdAt);

                return (
                  <React.Fragment key={msg.id}>
                    {/* Dekorativni razdjelnik datuma s dvije linije i datumom u sredini */}
                    {showDateDivider && (
                      <div className="flex items-center justify-center my-3 sm:my-4 gap-2 select-none w-full animate-fadeIn">
                        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-slate-700 to-teal-500/40" />
                        <div className="px-3.5 py-1 rounded-full bg-slate-900/95 border border-teal-500/35 text-[10px] sm:text-[11px] font-bold text-teal-300 shadow-md flex items-center gap-1.5 shrink-0">
                          <Calendar className="w-3 h-3 text-teal-400" />
                          <span>{dateLabel}</span>
                        </div>
                        <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-slate-700 to-teal-500/40" />
                      </div>
                    )}

                    <SwipeableMessageRow
                      msg={msg}
                      isMine={isMine}
                      readCount={readCount}
                      onOpenRename={handleOpenRenameUser}
                      onShowInfo={setSelectedMessageForInfo}
                      onReply={handleSelectReply}
                    />
                  </React.Fragment>
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

        {/* Prikaz poruke na koju se odgovara (Replay traka iznad unosa) */}
        {!isBlocked && replyingTo && (
          <div className="mx-3 my-1.5 p-2.5 rounded-2xl bg-slate-900/95 border-l-4 border-teal-400 border border-teal-500/35 flex items-center justify-between shadow-xl animate-fadeIn shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                <CornerUpLeft className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-teal-300 flex items-center gap-1.5 truncate">
                  <span>Odgovaraš ribiču:</span>
                  <span className="text-white font-black">{replyingTo.userName}</span>
                </p>
                <p className="text-xs sm:text-[13px] text-slate-300 truncate italic">
                  "{replyingTo.text}"
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="w-7 h-7 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
              title="Poništi odgovor"
            >
              <X className="w-4 h-4" />
            </button>
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
              placeholder={replyingTo ? `Odgovor ribiču (${replyingTo.userName})...` : 'Napiši poruku s Dunava...'}
              maxLength={350}
              className="flex-1 bg-slate-900 border border-slate-700/80 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 rounded-xl px-3.5 py-2.5 text-sm sm:text-base text-white placeholder-slate-500 outline-none transition-all"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-xs sm:text-sm transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
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
                <button
                  type="button"
                  onClick={() => handleOpenRenameUser(selectedMessageForInfo.deviceId, selectedMessageForInfo.userName)}
                  className="mt-1.5 w-full py-1.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Promijeni ime korisnika ({selectedMessageForInfo.userName})</span>
                </button>
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

        {/* Modal za administratorsku promjenu imena ribiča u LiveChatu */}
        {renameTarget && (
          <div 
            onClick={() => setRenameTarget(null)}
            className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-sm p-4 flex flex-col justify-center items-center animate-fadeIn select-text"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-5 shadow-2xl flex flex-col space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Promjena imena ribiča</h3>
                    <p className="text-[10px] text-amber-300 font-mono font-semibold">
                      Uređaj: {renameTarget.deviceId}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmRenameUser} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">
                    Novo ime (odmah vidljivo svim ribičima):
                  </label>
                  <input
                    type="text"
                    value={renameNewName}
                    onChange={(e) => setRenameNewName(e.target.value)}
                    placeholder="npr. Krasni, Marko, Ribič s Dunava..."
                    maxLength={30}
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 leading-normal pt-1">
                    Novo ime se odmah sinkronizira u centralni registar i prikazuje se uz sve poslane i buduće poruke ovog korisnika.
                  </p>
                </div>

                {renameError && (
                  <div className="text-xs text-rose-400 bg-rose-950/60 p-2 rounded-xl border border-rose-800/60 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{renameError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setRenameTarget(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Odustani
                  </button>
                  <button
                    type="submit"
                    disabled={isRenaming || !renameNewName.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-black text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    {isRenaming ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Spremi ime</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal za brzi unos administratorskog PIN-a ako korisnik još nije verificiran */}
        {showPinPrompt && (
          <div 
            onClick={() => setShowPinPrompt(false)}
            className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-sm p-4 flex flex-col justify-center items-center animate-fadeIn select-text"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs bg-slate-900 border border-teal-500/50 rounded-3xl p-5 shadow-2xl flex flex-col space-y-3.5 text-center"
            >
              <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-white">Administratorski pristup</h3>
              <p className="text-[11px] text-slate-400">
                Unesite PIN (2026) za uređivanje imena korisnika u LiveChatu:
              </p>
              <form onSubmit={handleAdminPinSubmit} className="space-y-3">
                <input
                  type="password"
                  maxLength={6}
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  placeholder="PIN (2026)"
                  autoFocus
                  className="w-full text-center tracking-widest text-lg font-mono bg-slate-950 border border-slate-700 focus:border-teal-400 rounded-xl px-3 py-2 text-white outline-none"
                />
                {adminPinError && (
                  <p className="text-[10px] text-rose-400 font-bold">Neispravan PIN. Pokušajte ponovno.</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPinPrompt(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs cursor-pointer"
                  >
                    Odustani
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs cursor-pointer"
                  >
                    Potvrdi
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal potvrde za administratorsko brisanje cijele povijesti chata */}
        {showClearConfirmModal && (
          <div 
            onClick={() => !isClearingChat && setShowClearConfirmModal(false)}
            className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-sm p-4 flex flex-col justify-center items-center animate-fadeIn select-none"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-slate-900 border border-rose-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto shadow-md">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-black text-white">Obriši povijest chata?</h3>
                <p className="text-xs text-rose-300 font-bold">
                  Ova radnja će trajno obrisati sve poruke u LiveChatu za sve korisnike!
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  Sve poruke bit će uklonjene iz centralne baze i sa svih mobilnih uređaja. Razgovor kreće potpuno ispočetka.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isClearingChat}
                  onClick={() => setShowClearConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                >
                  Odustani
                </button>
                <button
                  type="button"
                  disabled={isClearingChat}
                  onClick={handleConfirmClearChat}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white font-black text-xs cursor-pointer shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  {isClearingChat ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isClearingChat ? 'Brisanje...' : 'Obriši sve'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
