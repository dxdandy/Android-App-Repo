import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Ruler, 
  Calendar,
  Sparkles
} from 'lucide-react';

interface LovostajModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface FishRule {
  id: string;
  name: string;
  closedSeasonText: string;
  minSizeCm: number | null;
  minSizeText: string;
  notes: string;
  category: 'dunav' | 'pastrva' | 'ostalo';
  startMonth?: number;
  startDay?: number;
  endMonth?: number;
  endDay?: number;
}

export const FISH_RULES: FishRule[] = [
  {
    id: 'saran',
    name: 'Šaran',
    closedSeasonText: '1. 4. – 31. 5.',
    minSizeCm: 40,
    minSizeText: '40 cm',
    notes: 'Ne vrijedi za ribnjačke fenotipe (ljuskavi, veleljuskavi, maloljuskavi, goli).',
    category: 'dunav',
    startMonth: 4, startDay: 1, endMonth: 5, endDay: 31
  },
  {
    id: 'stuka',
    name: 'Štuka',
    closedSeasonText: '1. 2. – 31. 3.',
    minSizeCm: 40,
    minSizeText: '40 cm',
    notes: 'Osim u pastrvskim vodama.',
    category: 'dunav',
    startMonth: 2, startDay: 1, endMonth: 3, endDay: 31
  },
  {
    id: 'smud',
    name: 'Smuđ',
    closedSeasonText: '1. 3. – 31. 5.',
    minSizeCm: 40,
    minSizeText: '40 cm',
    notes: 'Stroga zabrana lova u mrijestu.',
    category: 'dunav',
    startMonth: 3, startDay: 1, endMonth: 5, endDay: 31
  },
  {
    id: 'som',
    name: 'Som',
    closedSeasonText: '16. 4. – 15. 6.',
    minSizeCm: 60,
    minSizeText: '60 cm',
    notes: 'Ne vrijedi za rijeku Dunav (na Dunavu som nema lovostaj).',
    category: 'dunav',
    startMonth: 4, startDay: 16, endMonth: 6, endDay: 15
  },
  {
    id: 'keciga',
    name: 'Kečiga',
    closedSeasonText: '1. 3. – 31. 5.',
    minSizeCm: 40,
    minSizeText: '40 cm',
    notes: 'Dunavska jesetarska vrsta.',
    category: 'dunav',
    startMonth: 3, startDay: 1, endMonth: 5, endDay: 31
  },
  {
    id: 'bolen',
    name: 'Bolen',
    closedSeasonText: '1. 4. – 31. 5.',
    minSizeCm: 40,
    minSizeText: '40 cm',
    notes: 'Samo dunavci: Poretak, Ostrovski, Vučedolski, Opatovački i Renovski.',
    category: 'dunav',
    startMonth: 4, startDay: 1, endMonth: 5, endDay: 31
  },
  {
    id: 'jez',
    name: 'Jez',
    closedSeasonText: '1. 5. – 31. 5.',
    minSizeCm: 25,
    minSizeText: '25 cm',
    notes: 'Samo dunavski rukavci.',
    category: 'dunav',
    startMonth: 5, startDay: 1, endMonth: 5, endDay: 31
  },
  {
    id: 'linjak',
    name: 'Linjak',
    closedSeasonText: 'Nema lovostaja',
    minSizeCm: 20,
    minSizeText: '20 cm',
    notes: 'Autohtona mirna vrsta.',
    category: 'ostalo'
  },
  {
    id: 'mrena',
    name: 'Mrena',
    closedSeasonText: 'Nema lovostaja',
    minSizeCm: 28,
    minSizeText: '28 cm',
    notes: 'Riječna riba brzih tokova i špornjeva.',
    category: 'dunav'
  },
  {
    id: 'mladica',
    name: 'Mladica',
    closedSeasonText: '16. 2. – 30. 9.',
    minSizeCm: 80,
    minSizeText: '80 cm',
    notes: 'Zaštićena plemenita vrsta.',
    category: 'pastrva',
    startMonth: 2, startDay: 16, endMonth: 9, endDay: 30
  },
  {
    id: 'glavatica',
    name: 'Glavatica',
    closedSeasonText: '16. 2. – 30. 9.',
    minSizeCm: 70,
    minSizeText: '70 cm',
    notes: 'Jadranski sliv.',
    category: 'pastrva',
    startMonth: 2, startDay: 16, endMonth: 9, endDay: 30
  },
  {
    id: 'lipljan',
    name: 'Lipljan',
    closedSeasonText: '1. 1. – 15. 5.',
    minSizeCm: 30,
    minSizeText: '30 cm',
    notes: 'Kupa i Kupica: 16. 10. – 15. 5.; najmanja mjera 32 cm.',
    category: 'pastrva',
    startMonth: 1, startDay: 1, endMonth: 5, endDay: 15
  },
  {
    id: 'potocna-pastrva',
    name: 'Potočna pastrva',
    closedSeasonText: '1. 10. – 31. 3.',
    minSizeCm: 30,
    minSizeText: '30 cm',
    notes: 'Kupa, Kupica, Čabranka, Žumberak: 1.10.–31.3. Ostale vode: 1.10.–kraja veljače. Na Gackoj min. 50 cm.',
    category: 'pastrva',
    startMonth: 10, startDay: 1, endMonth: 3, endDay: 31
  },
  {
    id: 'jezerska-pastrva',
    name: 'Jezerska pastrva',
    closedSeasonText: '1. 10. – kraja veljače',
    minSizeCm: 40,
    minSizeText: '40 cm',
    notes: 'Duboke akumulacije i prirodna jezera.',
    category: 'pastrva',
    startMonth: 10, startDay: 1, endMonth: 2, endDay: 28
  },
  {
    id: 'kalifornijska-pastrva',
    name: 'Kalifornijska pastrva',
    closedSeasonText: 'Nema lovostaja',
    minSizeCm: 30,
    minSizeText: '30 cm',
    notes: 'Unesena vrsta, lov dozvoljen cijele godine.',
    category: 'pastrva'
  },
  {
    id: 'mekousna-solinka',
    name: 'Mekousna pastrva (solinka)',
    closedSeasonText: '1. 10. – 31. 5.',
    minSizeCm: 30,
    minSizeText: '30 cm',
    notes: 'Rijeke Jadro i Vrljika.',
    category: 'pastrva',
    startMonth: 10, startDay: 1, endMonth: 5, endDay: 31
  },
  {
    id: 'mekousna-zlousta',
    name: 'Mekousna pastrva (zlousta)',
    closedSeasonText: '1. 10. – 31. 5.',
    minSizeCm: 30,
    minSizeText: '30 cm',
    notes: 'Rijeka Krka.',
    category: 'pastrva',
    startMonth: 10, startDay: 1, endMonth: 5, endDay: 31
  }
];

export const UNPROTECTED_SPECIES = [
  {
    name: 'Amur (bijeli amur)',
    description: 'Nije u nacionalnoj Naredbi, ali mnoga udruženja i ovlaštenici propisuju lokalnu mjeru i dnevni limit ulova. Provjeriti u dozvoli.'
  },
  {
    name: 'Klen',
    description: 'Nije u nacionalnoj Naredbi, lokalni ovlaštenici određuju eventualnu mjeru.'
  },
  {
    name: 'Babuška (srebrni karas)',
    description: 'Strana i invazivna vrsta. Lokalno najčešće vrijedi pravilo da se ulovljeni primjerci ne vraćaju u vodu.'
  },
  {
    name: 'Deverika',
    description: 'Nema nacionalno propisanu mjeru niti lovostaj, regulira se lokalnim ribolovnim propisima.'
  }
];

/**
 * Pomoćna funkcija za provjeru je li vrsta danas u lovostaju
 */
function isSpeciesInClosedSeasonToday(rule: FishRule): boolean {
  if (!rule.startMonth || !rule.endMonth || !rule.startDay || !rule.endDay) return false;
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const currentVal = month * 100 + day;
  const startVal = rule.startMonth * 100 + rule.startDay;
  const endVal = rule.endMonth * 100 + rule.endDay;

  if (startVal <= endVal) {
    return currentVal >= startVal && currentVal <= endVal;
  }
  return currentVal >= startVal || currentVal <= endVal;
}

export const LovostajModal: React.FC<LovostajModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'dunav' | 'pastrva' | 'closed_now'>('all');

  const filteredRules = useMemo(() => {
    return FISH_RULES.filter(rule => {
      if (selectedFilter === 'dunav' && rule.category !== 'dunav') return false;
      if (selectedFilter === 'pastrva' && rule.category !== 'pastrva') return false;
      if (selectedFilter === 'closed_now' && !isSpeciesInClosedSeasonToday(rule)) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = rule.name.toLowerCase().includes(query);
        const matchesClosed = rule.closedSeasonText.toLowerCase().includes(query);
        const matchesNotes = rule.notes.toLowerCase().includes(query);
        const matchesSize = rule.minSizeText.toLowerCase().includes(query);
        return matchesName || matchesClosed || matchesNotes || matchesSize;
      }
      return true;
    });
  }, [searchQuery, selectedFilter]);

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md select-none animate-fadeIn"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-emerald-500/40 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col h-[90vh] max-h-[820px] text-white relative overflow-hidden"
      >
        
        {/* Pozadinski svjetlosni ukras */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Zaglavlje modala - podignuto malo gore, kompaktno i bez kraćenja naslova */}
        <div className="px-3 py-2.5 sm:px-5 sm:py-3.5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0 text-base sm:text-lg shadow-sm">
              🐟
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs xs:text-sm sm:text-lg md:text-xl font-black text-white tracking-tight leading-tight">
                  Lovostaj i najmanja lovna mjera
                </h2>
                <span className="hidden xs:inline-block px-1.5 py-0.2 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  Službeni propis
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 leading-tight mt-0.5 truncate">
                Pregled ribljih vrsta, zabrana lova i minimalnih dužina
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-700/60 shrink-0"
            title="Zatvori pregled"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Glavni sadržaj - sve stane na ekran bez vodoravnog klizanja (NO overflow-x) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4.5 space-y-3.5 bg-slate-950/40 w-full max-w-full">
          
          {/* Tražilica i brzi filtri */}
          <div className="space-y-2">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pretraži vrstu (smuđ, som, šaran, štuka, bolen, pastrva)..."
                className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter gumbići */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
              <button
                type="button"
                onClick={() => setSelectedFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-[11px] sm:text-xs ${
                  selectedFilter === 'all'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Sve vrste ({FISH_RULES.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('dunav')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-[11px] sm:text-xs ${
                  selectedFilter === 'dunav'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-black'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                🌊 Dunav & rukavci
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('pastrva')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-[11px] sm:text-xs ${
                  selectedFilter === 'pastrva'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-black'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                🏔️ Pastrvske vode
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('closed_now')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-[11px] sm:text-xs ${
                  selectedFilter === 'closed_now'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                🔴 Trenutno u lovostaju
              </button>
            </div>
          </div>

          {/* POSEBNA NAPOMENA – DUNAVCI (Istaknuti okvir) */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs shadow-md space-y-1">
            <div className="flex items-center gap-1.5 font-black text-amber-300 text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>POSEBNA NAPOMENA – DUNAVCI</span>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-200/90 leading-relaxed font-semibold">
              Na dunavskim rukavcima vrijedi <span className="text-white underline decoration-amber-400 font-black">opća zabrana športskog ribolova od 1. veljače do 31. svibnja</span>.
            </p>
          </div>

          {/* GLAVNA TABLICA - UVIJEK 100% ŠIRINE BEZ VODORAVNOG KLIZANJA */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 overflow-hidden shadow-lg w-full">
            
            {/* 1. VERZIJA ZA MOBITELE (Kompaktne kartice - sve stane na širinu bez klizanja) */}
            <div className="sm:hidden divide-y divide-slate-800/80">
              {filteredRules.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Nema pronađenih vrsta.
                </div>
              ) : (
                filteredRules.map((rule) => {
                  const isClosedToday = isSpeciesInClosedSeasonToday(rule);
                  return (
                    <div 
                      key={rule.id}
                      className={`p-3 space-y-1.5 transition-colors ${
                        isClosedToday ? 'bg-rose-950/20' : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-black text-white text-sm tracking-tight truncate">
                            {rule.name}
                          </span>
                          {isClosedToday && (
                            <span className="px-1.5 py-0.2 rounded-md bg-rose-500/25 text-rose-300 border border-rose-500/40 text-[9px] font-black uppercase">
                              Zabrana
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-teal-950/80 border border-teal-500/30 text-teal-300 shrink-0">
                          min. {rule.minSizeText}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-400 text-[11px]">Lovostaj:</span>
                        {rule.closedSeasonText === 'Nema lovostaja' ? (
                          <span className="text-emerald-400 font-bold text-xs inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Nema lovostaja
                          </span>
                        ) : (
                          <span className="text-amber-300 font-bold text-xs font-mono inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                            {rule.closedSeasonText}
                          </span>
                        )}
                      </div>

                      {rule.notes && (
                        <p className="text-[11px] text-slate-400 bg-slate-900/70 p-2 rounded-xl border border-slate-800/80 leading-snug">
                          {rule.notes}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 2. VERZIJA ZA TABLETE I DESKTOP (Fiksna tablica širine točno 100% bez prelijevanja) */}
            <div className="hidden sm:block w-full">
              <table className="w-full table-fixed text-left text-xs">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[28%]" />
                  <col className="w-[18%]" />
                  <col className="w-[30%]" />
                </colgroup>
                <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Vrsta</th>
                    <th className="py-2.5 px-3">Lovostaj</th>
                    <th className="py-2.5 px-3 text-center">Najmanja mjera</th>
                    <th className="py-2.5 px-3">Napomena</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                        Nema pronađenih vrsta za zadani uvjet pretrage.
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((rule) => {
                      const isClosedToday = isSpeciesInClosedSeasonToday(rule);
                      return (
                        <tr 
                          key={rule.id}
                          className={`hover:bg-slate-900/60 transition-colors ${
                            isClosedToday ? 'bg-rose-950/15' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-black text-white text-xs sm:text-sm">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{rule.name}</span>
                              {isClosedToday && (
                                <span className="px-1.5 py-0.2 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-black uppercase">
                                  Lovostaj
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {rule.closedSeasonText === 'Nema lovostaja' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-xs">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Nema lovostaja
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-300 font-bold text-xs font-mono">
                                <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                                {rule.closedSeasonText}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-teal-300">
                              <Ruler className="w-3 h-3 text-teal-400" />
                              {rule.minSizeText}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-300 leading-snug break-words">
                            {rule.notes || <span className="text-slate-600">—</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* VRSTE BEZ NACIONALNOG LOVOSTAJA (Informativni odjeljak) */}
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 text-cyan-300 font-black text-xs sm:text-sm">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>VRSTE BEZ NACIONALNOG LOVOSTAJA</span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
              Za neke vrlo popularne vrste država ne propisuje lovostaj ni najmanju mjeru. To određuje lokalni ovlaštenik. <strong className="text-slate-200">Uvijek provjerite uvjete u svojoj ribolovnoj dozvoli.</strong>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              {UNPROTECTED_SPECIES.map((spec, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1">
                  <span className="font-black text-white text-xs block">
                    • {spec.name}
                  </span>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {spec.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
