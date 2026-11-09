import { 
  StationWaterData,
  SolunarDayData,
  WaterTrend,
  PressureTrend,
  WeatherCondition,
  MoonPhase,
  WaterLevelHistoryItem
} from '../types/fishing';
import { getApiUrl, safeFetchJson } from './licenseService';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export const CACHE_ALJMAS_KEY = 'ribo_cache_aljmas_station_data';
export const CACHE_BOGOJEVO_KEY = 'ribo_cache_bogojevo_station_data';

export const MVODOSTAJI_ALJMAS_URL = 'https://mvodostaji.voda.hr/Home/PregledVodostajaPostaje?sektorID=2&bpID=34&postajaID=1582';
export const SEATEMP_ALJMAS_VUKOVAR_URL = 'https://hr.seatemperature.net/current/croatia/water-temp-in-vukovar-in-danube';
export const HIDMET_BOGOJEVO_URL = 'https://www.hidmet.gov.rs/latin/hidrologija/izvestajne/prognoza.php?hm_id=42020';
export const HIDMET_BOGOJEVO_TEMP_URL = 'https://www.hidmet.gov.rs/latin/hidrologija/izvestajne/prognoza.php?hm_id=42015';
export const VENTUSKY_ALJMAS_URL = 'https://www.ventusky.com/45.529;18.95';
export const VENTUSKY_BOGOJEVO_URL = 'https://www.ventusky.com/45.53;19.13';
export const YR_ALJMAS_URL = 'https://www.yr.no/en/forecast/daily-table/2-3244159/Croatia/Vukovar-Srijem%20County/Aljmas';
export const YR_BOGOJEVO_URL = 'https://www.yr.no/en/forecast/daily-table/2-12503703/Serbia/Vojvodina/West%20Ba%C4%8Dka%20District/Bogojevo%20border%20checkpoint';

export function getWindDirectionLabel(degrees?: number): string {
  if (degrees === undefined) return 'Promjenjiv';
  const directions = ['S', 'SI', 'I', 'JI', 'J', 'JZ', 'Z', 'SZ'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

export function mapWmoToCondition(code?: number): WeatherCondition {
  if (code === undefined) return 'djelomicno_oblacno';
  if (code === 0) return 'vedro';
  if (code === 1 || code === 2) return 'djelomicno_oblacno';
  if (code === 3) return 'oblacno';
  if (code >= 45 && code <= 48) return 'magla';
  if (code >= 51 && code <= 65) return 'slaba_kisa';
  if (code >= 66 && code <= 82) return 'pljusak';
  if (code >= 95) return 'grmljavina';
  return 'djelomicno_oblacno';
}

/**
 * Precizni izračun mjesečeve mijene i osvijetljenosti
 */
export function calculateMoonPhaseDetails(date: Date): { 
  phase: MoonPhase; 
  phaseName: string; 
  illuminationPct: number;
  ageDays: number;
} {
  // Poznata referentna točka mlađaka
  const refDate = new Date('2026-01-18T18:50:00Z');
  const synodicMonth = 29.53058867;
  const diffTime = date.getTime() - refDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const ageDays = ((diffDays % synodicMonth) + synodicMonth) % synodicMonth;
  
  // Postotak osvijetljenosti (0% do 100%)
  const illuminationPct = Math.round((1 - Math.cos((ageDays / synodicMonth) * 2 * Math.PI)) / 2 * 100);

  let phase: MoonPhase = 'mladjak';
  let phaseName = 'Mlađak (Novi Mjesec)';

  if (ageDays < 1.84) {
    phase = 'mladjak';
    phaseName = 'Mlađak (Novi Mjesec)';
  } else if (ageDays < 7.38) {
    phase = 'rastuci_srp';
    phaseName = 'Rastući srp';
  } else if (ageDays < 9.22) {
    phase = 'prva_cetvrt';
    phaseName = 'Prva četvrt';
  } else if (ageDays < 14.76) {
    phase = 'rastuci_srp';
    phaseName = 'Rastući Mjesec (Grbavi)';
  } else if (ageDays < 16.61) {
    phase = 'pun_mjesec';
    phaseName = 'Pun Mjesec (Uštap)';
  } else if (ageDays < 22.15) {
    phase = 'opadajuci_srp';
    phaseName = 'Opadajući Mjesec';
  } else if (ageDays < 23.99) {
    phase = 'zadnja_cetvrt';
    phaseName = 'Zadnja četvrt';
  } else {
    phase = 'opadajuci_srp';
    phaseName = 'Opadajući srp';
  }

  return { phase, phaseName, illuminationPct, ageDays };
}

/**
 * Formatiranje vremena HH:MM
 */
function padZero(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatHoursMinutes(hoursFloat: number): string {
  const norm = ((hoursFloat % 24) + 24) % 24;
  const h = Math.floor(norm);
  const m = Math.floor((norm - h) * 60);
  return `${padZero(h)}:${padZero(m)}`;
}

/**
 * Određuje točan i prirodan naziv perioda prema stvarnom satu u danu
 */
function getDynamicPeriodTitle(hoursFloat: number, type: 'major' | 'minor'): string {
  const norm = ((hoursFloat % 24) + 24) % 24;
  if (type === 'major') {
    if (norm >= 4.5 && norm < 11.5) return 'Jutarnji vrhunac';
    if (norm >= 11.5 && norm < 17) return 'Dnevni vrhunac';
    if (norm >= 17 && norm < 22) return 'Večernji vrhunac';
    return 'Noćni vrhunac';
  } else {
    if (norm >= 4.5 && norm < 11.5) return 'Jutarnji impuls';
    if (norm >= 11.5 && norm < 17) return 'Popodnevni impuls';
    if (norm >= 17 && norm < 22) return 'Večernji impuls';
    return 'Noćni impuls';
  }
}

/**
 * Generiranje cjelokupnih solunarnih rezultata za današnji dan na Dunavu
 */
export function getSolunarDataForDate(
  date: Date = new Date(),
  pressureHpa: number = 1017,
  pressureTrend: PressureTrend = 'stabilan'
): SolunarDayData {
  const dateStr = date.toISOString().split('T')[0];
  const { phase, phaseName, illuminationPct, ageDays } = calculateMoonPhaseDetails(date);

  // Izračun kretanja Mjeseca za geografsko područje Dunava (cca 45.5°N, 19.0°E)
  // Prosječni pomak tranzita Mjeseca je ~50 minuta kasnije svaki dan
  const moonTransitHour = ((ageDays * 0.84 + 11.5) % 24);
  const moonUnderfootHour = (moonTransitHour + 12) % 24;
  const moonriseHour = (moonTransitHour - 6 + 24) % 24;
  const moonsetHour = (moonTransitHour + 6) % 24;

  // Glavna razdoblja (Major periods ~ 2 sata)
  const major1Start = (moonTransitHour - 1 + 24) % 24;
  const major1End = (moonTransitHour + 1) % 24;

  const major2Start = (moonUnderfootHour - 1 + 24) % 24;
  const major2End = (moonUnderfootHour + 1) % 24;

  // Sporedna razdoblja (Minor periods ~ 1 sat)
  const minor1Start = (moonriseHour - 0.5 + 24) % 24;
  const minor1End = (moonriseHour + 0.5) % 24;

  const minor2Start = (moonsetHour - 0.5 + 24) % 24;
  const minor2End = (moonsetHour + 0.5) % 24;

  // Sunčevi ciklusi (listopad / proljeće za Slavoniju / Podunavlje)
  const sunriseHour = 6.35; // 06:21 h
  const sunsetHour = 18.05;  // 18:03 h

  // Ocjena dana na temelju solunara i barometra
  let score = 3;
  if (phase === 'mladjak' || phase === 'pun_mjesec') score += 1;
  if (pressureHpa >= 1012 && pressureHpa <= 1019) score += 1;
  if (pressureTrend === 'stabilan' || pressureTrend === 'pad') score += 0.5;
  if (pressureHpa < 1005 || pressureHpa > 1026) score -= 1;
  const finalScore = Math.min(5, Math.max(1, Math.round(score)));

  let ratingText = 'Vrlo dobro';
  let activityPercentage = 84;
  if (finalScore >= 5) {
    ratingText = 'Izvrsno (Vrhunski uvjeti)';
    activityPercentage = 95;
  } else if (finalScore === 4) {
    ratingText = 'Vrlo dobro';
    activityPercentage = 82;
  } else if (finalScore === 3) {
    ratingText = 'Dobro / Umjereno';
    activityPercentage = 65;
  } else {
    ratingText = 'Slabo / Pasivno';
    activityPercentage = 42;
  }

  // Izračun aktivnosti po satima (00:00 - 23:00)
  const hourlyActivity = Array.from({ length: 24 }).map((_, hour) => {
    let hourScore = 2; // osnovna aktivnost

    // Provjera poklapanja s Major 1
    const inMajor1 = isHourInRange(hour, major1Start, major1End);
    const inMajor2 = isHourInRange(hour, major2Start, major2End);
    const inMinor1 = isHourInRange(hour, minor1Start, minor1End);
    const inMinor2 = isHourInRange(hour, minor2Start, minor2End);
    const nearSunrise = Math.abs(hour - Math.floor(sunriseHour)) <= 1;
    const nearSunset = Math.abs(hour - Math.floor(sunsetHour)) <= 1;

    if (inMajor1 || inMajor2) hourScore += 2;
    if (inMinor1 || inMinor2) hourScore += 1;
    if (nearSunrise || nearSunset) hourScore += 1;

    hourScore = Math.min(5, hourScore);

    let status: 'vrhunac' | 'visoka' | 'srednja' | 'normalna' = 'normalna';
    if (hourScore >= 5) status = 'vrhunac';
    else if (hourScore === 4) status = 'visoka';
    else if (hourScore === 3) status = 'srednja';

    return {
      hour,
      hourLabel: `${padZero(hour)}:00`,
      score: hourScore,
      status
    };
  });

  const croatianDayName = date.toLocaleDateString('hr-HR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const fishAdvices = [
    {
      species: 'Smuđ (Stizostedion lucioperca)',
      icon: '🐟',
      recommendedDepth: '4 - 7 m na padinama i špornjevima',
      recommendedBaits: 'Silikonski šedovi 8-11 cm, keder (uklija, peš), vobleri u sumrak',
      advice: `Vrhunac aktivnosti poklapa se s Major 2 (${formatHoursMinutes(major2Start)} - ${formatHoursMinutes(major2End)}) i sumrakom. Na ušću Drave u Dunav (Aljmaš) i kamenim špornjevima u Bogojevu držite se zone jakog toka i povratnih struja.`
    },
    {
      species: 'Som (Silurus glanis)',
      icon: '🐋',
      recommendedDepth: '6 - 12 m u limanima i rupama',
      recommendedBaits: 'Snop durboka, crne gliste, živa babuška ili veća glavinjava',
      advice: `Aktivira se u satima oko zalaska Sunca (${formatHoursMinutes(sunsetHour)}) i tijekom noćnog solunarnog vrhunca. Povoljan stabilan tlak zraka potiče kretanje iz dubljih rupa prema plićacima.`
    },
    {
      species: 'Šaran (Cyprinus carpio)',
      icon: '🐠',
      recommendedDepth: '3 - 5 m na tvrdom dnu i školjkastim sprudovima',
      recommendedBaits: 'Kuhani kukuruz s aromom vanilije/školjke, tigrov oraščić, boilie',
      advice: `Hranjenje je najintenzivnije tijekom Major 1 (${formatHoursMinutes(major1Start)} - ${formatHoursMinutes(major1End)}). Prihranjujte točkasto i tražite prijelaze iz mulja u šljunak uz dunavsku obalu.`
    },
    {
      species: 'Bolen & Štuka (Aspius & Esox)',
      icon: '🦈',
      recommendedDepth: '0.5 - 2 m pri površini i oko preljeva',
      recommendedBaits: 'Teški površinski vobleri, kastmasteri, bijele spužvice',
      advice: `Bolen raubuje u zoru (${formatHoursMinutes(sunriseHour)}) i pred zalazak. Na špornju u Aljmašu gađajte točno rub matice i mirne vode.`
    }
  ];

  // Određivanje najboljeg trenutka dana (Maksimalni griz)
  const distMajor1Sun = Math.min(
    Math.abs(moonTransitHour - sunriseHour),
    Math.abs(moonTransitHour - sunsetHour),
    Math.abs(moonTransitHour - 24),
    Math.abs(moonTransitHour - 0)
  );
  const distMajor2Sun = Math.min(
    Math.abs(moonUnderfootHour - sunriseHour),
    Math.abs(moonUnderfootHour - sunsetHour),
    Math.abs(moonUnderfootHour - 24),
    Math.abs(moonUnderfootHour - 0)
  );
  const isMajor1Best = distMajor1Sun <= distMajor2Sun;

  return {
    date: dateStr,
    formattedDate: croatianDayName.charAt(0).toUpperCase() + croatianDayName.slice(1),
    moonPhase: phase,
    moonPhaseName: phaseName,
    illuminationPct,
    major1: {
      title: getDynamicPeriodTitle(moonTransitHour, 'major'),
      badge: 'Glavno razdoblje (Major)',
      start: formatHoursMinutes(major1Start),
      end: formatHoursMinutes(major1End),
      peak: formatHoursMinutes(moonTransitHour),
      description: 'Mjesec u zenitu (Gornja kulminacija) • Glavni solunar, jak gravitacijski utjecaj',
      isPeakOfDay: isMajor1Best
    },
    major2: {
      title: getDynamicPeriodTitle(moonUnderfootHour, 'major'),
      badge: 'Glavno razdoblje (Major)',
      start: formatHoursMinutes(major2Start),
      end: formatHoursMinutes(major2End),
      peak: formatHoursMinutes(moonUnderfootHour),
      description: 'Mjesec u nadiru (Donja kulminacija) • Glavni solunar, intenzivno hranjenje riba',
      isPeakOfDay: !isMajor1Best
    },
    minor1: {
      title: getDynamicPeriodTitle(minor1Start + 0.5, 'minor'),
      badge: 'Sporedno razdoblje (Minor)',
      start: formatHoursMinutes(minor1Start),
      end: formatHoursMinutes(minor1End),
      description: 'Izlazak Mjeseca • Sporedni solunar, poticaj na kretanje i hranjenje',
      isPeakOfDay: false
    },
    minor2: {
      title: getDynamicPeriodTitle(minor2Start + 0.5, 'minor'),
      badge: 'Sporedno razdoblje (Minor)',
      start: formatHoursMinutes(minor2Start),
      end: formatHoursMinutes(minor2End),
      description: 'Zalazak Mjeseca • Sporedni solunar, kratak period pojačane aktivnosti',
      isPeakOfDay: false
    },
    sunrise: formatHoursMinutes(sunriseHour),
    sunset: formatHoursMinutes(sunsetHour),
    moonrise: formatHoursMinutes(moonriseHour),
    moonset: formatHoursMinutes(moonsetHour),
    goldenHourMorning: `${formatHoursMinutes(sunriseHour - 0.2)} - ${formatHoursMinutes(sunriseHour + 0.8)}`,
    goldenHourEvening: `${formatHoursMinutes(sunsetHour - 0.8)} - ${formatHoursMinutes(sunsetHour + 0.3)}`,
    overallScore: finalScore,
    activityPercentage,
    ratingText,
    summaryExplanation: `Današnja faza (${phaseName}, ${illuminationPct}% osvijetljenost) i stabilan barometar (${pressureHpa} hPa) stvaraju izvrsne predispozicije za hranjenje grabežljivaca na Dunavu.`,
    hourlyActivity,
    fishAdvices
  };
}

function isHourInRange(hour: number, start: number, end: number): boolean {
  if (start <= end) {
    return hour >= Math.floor(start) && hour <= Math.ceil(end);
  }
  // Prijelaz preko ponoći
  return hour >= Math.floor(start) || hour <= Math.ceil(end);
}

/**
 * Dohvat meteoroloških podataka za lokaciju preko Open-Meteo
 */
export async function fetchMeteoForCoords(lat: number, lon: number): Promise<{
  airPressureHpa: number;
  airPressureTrend: PressureTrend;
  airTempC: number;
  windSpeedKmh: number;
  windSpeedMs: number;
  windDirection: string;
  weatherCondition: WeatherCondition;
}> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,pressure_msl,surface_pressure,weather_code,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=Europe%2FZagreb`,
      { signal: AbortSignal.timeout(4500) }
    );
    if (!res.ok) throw new Error('Meteo status ' + res.status);
    const data = await res.json();
    const curr = data.current || {};

    // UVIJEK koristi barometarski tlak sveden na razinu mora (pressure_msl) - točno kao na Ventusky
    const pressure = curr.pressure_msl 
      ? Math.round(curr.pressure_msl) 
      : (curr.surface_pressure ? Math.round(curr.surface_pressure) : 1021);
    const temp = curr.temperature_2m !== undefined ? Math.round(curr.temperature_2m * 10) / 10 : 8.5;
    const windSpeedMs = curr.wind_speed_10m !== undefined ? Math.round(curr.wind_speed_10m * 10) / 10 : 3.3;
    const windSpeedKmh = Math.round(windSpeedMs * 3.6);
    const windDir = getWindDirectionLabel(curr.wind_direction_10m);
    const cond = mapWmoToCondition(curr.weather_code);

    let trend: PressureTrend = 'stabilan';
    if (pressure > 1019) trend = 'rast';
    else if (pressure < 1012) trend = 'pad';

    return {
      airPressureHpa: pressure,
      airPressureTrend: trend,
      airTempC: temp,
      windSpeedKmh: windSpeedKmh,
      windSpeedMs: windSpeedMs,
      windDirection: windDir,
      weatherCondition: cond
    };
  } catch (err) {
    return {
      airPressureHpa: 1021,
      airPressureTrend: 'stabilan',
      airTempC: 8.5,
      windSpeedKmh: 12,
      windSpeedMs: 3.3,
      windDirection: 'SZ',
      weatherCondition: 'djelomicno_oblacno'
    };
  }
}

/**
 * Univerzalni dohvat sirovog HTML/tekst sadržaja.
 * Na Android uređaju koristi native CapacitorHttp (bypassa sve CORS i kolačiće).
 * U web pregledniku koristi standardni fetch uz automatski fallback na CORS proxy.
 */
async function fetchUniversalText(url: string, timeoutMs = 8000): Promise<string | null> {
  // 1. Ako je nativna Android aplikacija (Capacitor)
  if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.get({
        url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cookie': 'units=m; p=hpa;'
        },
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs
      });
      if (response && response.status === 200 && response.data) {
        return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      }
    } catch (e) {
      console.warn(`CapacitorHttp native fetch failed for ${url}:`, e);
    }
  }

  // 2. Standardni web fetch
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml,*/*'
      }
    });
    if (res.ok) {
      return await res.text();
    }
  } catch {}

  // 3. Fallback na CORS proxy u slučaju da je poziv u web pregledniku
  const proxies = [
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`
  ];
  for (const proxyGen of proxies) {
    try {
      const proxyUrl = proxyGen(url);
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) {
        return await res.text();
      }
    } catch {}
  }

  return null;
}

/**
 * Univerzalni dohvat JSON podataka (Capacitor native ili web fetch)
 */
async function fetchUniversalJson<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.get({
        url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36',
          'Accept': 'application/json'
        },
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs
      });
      if (response && response.status === 200 && response.data) {
        if (typeof response.data === 'object' && response.data !== null) {
          return response.data as T;
        }
        if (typeof response.data === 'string') {
          return JSON.parse(response.data) as T;
        }
      }
    } catch (e) {
      console.warn(`CapacitorHttp native json failed for ${url}:`, e);
    }
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  return null;
}

/**
 * Parsiranje HTML-a sa stranice mvodostaji.voda.hr (Aljmaš - podatak sa samog vrha tablice)
 */
function parseAljmasHtml(html: string) {
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const rows: Array<{
    date: string;
    time: string;
    level: number;
    trendChange: number;
  }> = [];

  for (const tr of trMatches) {
    if (tr.includes('<th') || tr.includes('headline_postaja') || tr.includes('Maksimum:')) continue;
    const tds = tr.match(/<td[\s\S]*?<\/td>/gi);
    if (tds && tds.length >= 4) {
      const cleanTexts = tds.map(td => td.replace(/<[^>]+>/g, '').trim());
      let dateVal = '';
      let timeVal = '';
      let levelVal: number | null = null;
      let changeVal = 0;

      for (const txt of cleanTexts) {
        if (!dateVal && /^\d{2}\.\d{2}\.\d{2}\.?$/.test(txt)) {
          dateVal = txt;
        } else if (!timeVal && /^\d{2}:\d{2}$/.test(txt)) {
          timeVal = txt;
        } else if (levelVal === null && /^[+-]?\d+$/.test(txt)) {
          levelVal = parseInt(txt, 10);
        } else if (levelVal !== null && /^[+-]?\d+$/.test(txt)) {
          changeVal = parseInt(txt, 10);
        }
      }

      if (dateVal && timeVal && levelVal !== null) {
        rows.push({
          date: dateVal,
          time: timeVal,
          level: levelVal,
          trendChange: changeVal
        });
        if (rows.length >= 24) break;
      }
    }
  }

  if (rows.length === 0) return null;

  const maxMatch = html.match(/Maksimum:\s*([+-]?\d+)\s*cm(?:,\s*([^.<]+))?/i);
  const prepMatch = html.match(/Pripremno stanje\s*:\s*([+-]?\d+)/i);

  const latest = rows[0];
  let trend: WaterTrend = 'stagnira';
  if (latest.trendChange > 0) trend = 'u_porastu';
  else if (latest.trendChange < 0) trend = 'opada';

  return {
    waterLevelCm: latest.level,
    waterLevelTrend: trend,
    waterLevelChangeCm: latest.trendChange,
    timeOfMeasurement: latest.time,
    dateOfMeasurement: latest.date,
    maxLevelCm: maxMatch ? parseInt(maxMatch[1], 10) : 820,
    maxLevelDate: maxMatch && maxMatch[2] ? maxMatch[2].trim() : '25.06.1965.',
    prepLevelCm: prepMatch ? parseInt(prepMatch[1], 10) : 400,
    recentHistory: rows.slice(0, 10).map(r => ({
      date: r.date,
      time: r.time,
      level: r.level,
      trendChange: r.trendChange
    }))
  };
}

/**
 * Parsiranje HTML-a sa stranice hidmet.gov.rs (Bogojevo)
 */
function parseBogojevoHtml(html: string) {
  const levelMatch = html.match(/nivo\.gif[^>]*\/>(?:&nbsp;|\s)*([+-]?\d+)/i);
  const changeMatch = html.match(/promena\.gif[^>]*\/>(?:&nbsp;|\s)*([+-]?\d+)/i);
  const flowMatch = html.match(/([+-]?\d+)\s*(?:&nbsp;)?<img[^>]*protok\.gif/i)
                 || html.match(/protok\.gif[^>]*\/>(?:&nbsp;|\s)*([+-]?\d+)/i)
                 || html.match(/([+-]?\d+)<img src="[^"]*protok\.gif/i);
  const trendMatch = html.match(/ikonice\/interf\/(rast|pad|stagn|opad)/i);
  const forecastMatch = html.match(/Vodostaj&nbsp;\(cm\):\s*<\/td>(.*?)(?:<\/tr>|Dijagrami)/s);

  if (!levelMatch) return null;

  const parsedLevel = parseInt(levelMatch[1], 10);
  const parsedChange = changeMatch ? parseInt(changeMatch[1], 10) : 0;
  const parsedFlow = flowMatch ? parseInt(flowMatch[1], 10) : 1200;

  let parsedTrend: WaterTrend = 'opada';
  if (trendMatch) {
    const t = trendMatch[1].toLowerCase();
    if (t.includes('rast')) parsedTrend = 'u_porastu';
    else if (t.includes('opad') || t.includes('pad')) parsedTrend = 'opada';
    else parsedTrend = 'stagnira';
  } else if (parsedChange > 0) {
    parsedTrend = 'u_porastu';
  } else if (parsedChange < 0) {
    parsedTrend = 'opada';
  } else {
    parsedTrend = 'stagnira';
  }

  let forecastDays: number[] = [];
  if (forecastMatch && forecastMatch[1]) {
    const numbers = forecastMatch[1].match(/>([+-]?\d+)</g);
    if (numbers) {
      forecastDays = numbers.map(n => parseInt(n.replace(/[><]/g, ''), 10)).filter(n => !isNaN(n));
    }
  }

  return {
    waterLevelCm: parsedLevel,
    waterLevelChangeCm: parsedChange,
    waterLevelTrend: parsedTrend,
    flowM3s: parsedFlow,
    forecastDays: forecastDays.length > 0 ? forecastDays : [-44, -41, -43, -50]
  };
}

/**
 * Izravan dohvat prognoze (temperatura i barometarski tlak) s Yr.no
 */
async function fetchDirectYrNoForecast(locationId: string): Promise<{ temperature: number | null; pressure: number | null }> {
  try {
    const data = await fetchUniversalJson<any>(`https://www.yr.no/api/v0/locations/${locationId}/forecast`);
    if (data) {
      let temperature: number | null = null;
      let pressure: number | null = null;

      if (Array.isArray(data.shortIntervals) && data.shortIntervals.length > 0) {
        const item = data.shortIntervals[0];
        if (typeof item.temperature?.value === 'number') {
          temperature = Math.round(item.temperature.value * 10) / 10;
        }
        if (typeof item.pressure?.value === 'number') {
          pressure = Math.round(item.pressure.value);
        }
      }
      if (temperature === null && Array.isArray(data.dayIntervals) && data.dayIntervals.length > 0) {
        const item = data.dayIntervals[0];
        if (typeof item.temperature?.value === 'number') {
          temperature = Math.round(item.temperature.value * 10) / 10;
        }
      }
      return { temperature, pressure };
    }
  } catch {}
  return { temperature: null, pressure: null };
}

/**
 * Izravan dohvat tlaka zraka s Ventusky uz višeslojnu provjeru (Ventusky -> Yr.no MSL -> Open-Meteo MSL)
 */
async function fetchDirectVentuskyPressure(lat: number, lon: number, yrLocationId?: string): Promise<number | null> {
  // 1. Primarni izvor: Ventusky službena stranica
  try {
    const html = await fetchUniversalText(`https://www.ventusky.com/${lat};${lon}`);
    if (html) {
      const tableMatch = html.match(/(?:Tlak zraka|Air pressure|Pressure)[^<]*<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<b>[\s\S]*?(\d{3,4})[\s\S]*?hPa/i)
        || html.match(/<b>\s*(\d{3,4})\s*(?:&nbsp;|\s)*hPa\s*<\/b>/i)
        || html.match(/(\d{3,4})\s*(?:&nbsp;|\s)*hPa/i);
      if (tableMatch && tableMatch[1]) {
        const val = parseInt(tableMatch[1], 10);
        if (val >= 940 && val <= 1065) return val;
      }
      const inHgMatch = html.match(/(?:Tlak zraka|Air pressure)[^<]*<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<b>\s*(\d+(?:\.\d+)?)\s*(?:&nbsp;|\s)*inHg/i);
      if (inHgMatch && inHgMatch[1]) {
        const inhg = parseFloat(inHgMatch[1]);
        if (!isNaN(inhg)) return Math.round(inhg * 33.8639);
      }
    }
  } catch {}

  // 2. Automatska provjera s Yr.no (isti točan barometarski MSL tlak)
  if (yrLocationId) {
    try {
      const yr = await fetchDirectYrNoForecast(yrLocationId);
      if (typeof yr.pressure === 'number' && yr.pressure >= 940 && yr.pressure <= 1065) {
        return yr.pressure;
      }
    } catch {}
  }

  // 3. Rezervni dohvat točnog MSL barometarskog tlaka (razina mora) za koordinate
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=pressure_msl&timezone=Europe%2FZagreb`, {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const mData = await res.json();
      const p = mData.current?.pressure_msl;
      if (typeof p === 'number' && p >= 940 && p <= 1065) return Math.round(p);
    }
  } catch {}

  return null;
}

/**
 * Izravan dohvat temperature vode Dunava za Aljmaš (s hr.seatemperature.net - oznaka Danas)
 */
async function fetchDirectAljmasWaterTemp(): Promise<number | null> {
  try {
    const html = await fetchUniversalText(SEATEMP_ALJMAS_VUKOVAR_URL);
    if (html) {
      const danasBlockMatch = html.match(/<div class="temp-value">\s*([+-]?\d+[.,]?\d*)\s*<span>°C<\/span><\/div>\s*<div class="temp-label">\s*Danas\s*<\/div>/i)
        || html.match(/<div class="temp-block[^"]*">\s*<div class="temp-value">\s*([+-]?\d+[.,]?\d*)/i)
        || html.match(/danas je\s*([+-]?\d+[.,]?\d*)\s*°C/i);
      if (danasBlockMatch && danasBlockMatch[1]) {
        const val = parseFloat(danasBlockMatch[1].replace(',', '.'));
        if (!isNaN(val)) return val;
      }
    }
  } catch (err) {
    console.warn('Greška pri izravnom dohvatu temperature vode za Aljmaš:', err);
  }
  return null;
}

/**
 * Izravan dohvat temperature vode Dunava za Bogojevo (s hidmet.gov.rs hm_id=42015)
 */
async function fetchDirectBogojevoWaterTemp(): Promise<number | null> {
  try {
    const html = await fetchUniversalText(HIDMET_BOGOJEVO_TEMP_URL);
    if (html) {
      const tempMatch = html.match(/temp\.gif[^>]*\/>(?:&nbsp;|\s)*([+-]?\d+[.,]?\d*)/i);
      if (tempMatch && tempMatch[1]) {
        const val = parseFloat(tempMatch[1].replace(',', '.'));
        if (!isNaN(val)) return val;
      }
    }
  } catch (err) {
    console.warn('Greška pri izravnom dohvatu temperature vode za Bogojevo:', err);
  }
  return null;
}

export function getStoredAljmasData(): StationWaterData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_ALJMAS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Očisti ako je zaostala stara neispravna vrijednost -76, stari tlak ili stara fiksna temp vode 11.4
    if (
      parsed &&
      (parsed.waterLevelCm === -76 ||
        typeof parsed.waterLevelCm !== 'number' ||
        parsed.waterTempC === 11.4 ||
        (parsed.airPressureHpa && parsed.airPressureHpa < 1012))
    ) {
      localStorage.removeItem(CACHE_ALJMAS_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getStoredBogojevoData(): StationWaterData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_BOGOJEVO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Očisti ako je zaostala stara neispravna vrijednost -83, stari tlak ili stara fiksna temp vode 11.6
    if (
      parsed &&
      (parsed.waterLevelCm === -83 ||
        typeof parsed.waterLevelCm !== 'number' ||
        parsed.waterTempC === 11.6 ||
        (parsed.airPressureHpa && parsed.airPressureHpa < 1012))
    ) {
      localStorage.removeItem(CACHE_BOGOJEVO_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Dohvat službenih podataka za Aljmaš (mvodostaji.voda.hr + seatemperature.net + Yr.no + Ventusky + Firestore sinkronizacija)
 */
export async function fetchAljmasStationData(): Promise<StationWaterData> {
  const meteo = await fetchMeteoForCoords(45.5269, 18.9489);
  const cached = getStoredAljmasData();

  let waterLevelCm = cached ? cached.waterLevelCm : -70;
  let waterLevelTrend: WaterTrend = cached ? cached.waterLevelTrend : 'stagnira';
  let waterLevelChangeCm = cached ? cached.waterLevelChangeCm : 0;
  let timeOfMeasurement = cached ? cached.timeOfMeasurement : '08:00';
  let dateOfMeasurement = cached ? cached.dateOfMeasurement : new Date().toLocaleDateString('hr-HR');
  let maxLevelCm = cached?.maxLevelCm || 820;
  let maxLevelDate = cached?.maxLevelDate || '25.06.1965.';
  let prepLevelCm = cached?.prepLevelCm || 400;
  let airTempC = cached?.airTempC ?? 11.4;
  let waterTempC = cached?.waterTempC ?? 9.8;
  let isLive = Boolean(cached?.isLive);
  let history: WaterLevelHistoryItem[] = cached?.recentHistory && cached.recentHistory.length > 0
    ? cached.recentHistory
    : [
      { date: dateOfMeasurement, time: '08:00', level: -70, trendChange: 0 },
      { date: dateOfMeasurement, time: '07:00', level: -70, trendChange: 0 },
      { date: dateOfMeasurement, time: '06:00', level: -70, trendChange: 0 }
    ];

  let airPressureHpa = meteo.airPressureHpa;
  let airPressureTrend: PressureTrend = meteo.airPressureTrend;

  let fetchedFromBackend = false;

  // 1. Pokušaj dohvata preko poslužitelja (u web pregledniku)
  try {
    const isCapacitorNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
    if (!isCapacitorNative) {
      const res = await safeFetchJson<any>(getApiUrl('/api/water/aljmas'));
      if (res.ok && res.data && res.data.waterLevelCm !== undefined && res.data.waterLevelCm !== -76) {
        const data = res.data;
        waterLevelCm = data.waterLevelCm;
        waterLevelTrend = data.waterLevelTrend || 'stagnira';
        waterLevelChangeCm = data.waterLevelChangeCm || 0;
        timeOfMeasurement = data.timeOfMeasurement || timeOfMeasurement;
        dateOfMeasurement = data.dateOfMeasurement || dateOfMeasurement;
        maxLevelCm = data.maxLevelCm || 820;
        maxLevelDate = data.maxLevelDate || maxLevelDate;
        prepLevelCm = data.prepLevelCm || 400;
        if (data.airTempC !== undefined) airTempC = data.airTempC;
        if (data.waterTempC !== undefined) waterTempC = data.waterTempC;
        if (data.airPressureHpa !== undefined) {
          airPressureHpa = data.airPressureHpa;
          if (airPressureHpa > 1019) airPressureTrend = 'rast';
          else if (airPressureHpa < 1012) airPressureTrend = 'pad';
          else airPressureTrend = 'stabilan';
        }
        isLive = Boolean(data.isLive);
        if (Array.isArray(data.recentHours) && data.recentHours.length > 0) {
          history = data.recentHours.map((r: any) => ({
            date: r.date,
            time: r.time,
            level: r.level,
            trendChange: r.trendChange
          }));
        }
        fetchedFromBackend = true;
      }
    }
  } catch {}

  // 2. Provjeri Firestore sinkronizirane podatke poslužitelja (water_stations/aljmas) kako bi mobitel i računalo bili 100% identični
  if (!fetchedFromBackend) {
    try {
      const snap = await Promise.race([
        getDoc(doc(db, 'water_stations', 'aljmas')),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 3500))
      ]);
      if (snap && (snap as any).exists && (snap as any).exists()) {
        const data = (snap as any).data();
        if (data && typeof data.waterLevelCm === 'number') {
          waterLevelCm = data.waterLevelCm;
          waterLevelTrend = data.waterLevelTrend || 'stagnira';
          waterLevelChangeCm = data.waterLevelChangeCm || 0;
          timeOfMeasurement = data.timeOfMeasurement || timeOfMeasurement;
          dateOfMeasurement = data.dateOfMeasurement || dateOfMeasurement;
          if (typeof data.airTempC === 'number') airTempC = data.airTempC;
          if (typeof data.waterTempC === 'number') waterTempC = data.waterTempC;
          if (typeof data.airPressureHpa === 'number') {
            airPressureHpa = data.airPressureHpa;
            if (airPressureHpa > 1019) airPressureTrend = 'rast';
            else if (airPressureHpa < 1012) airPressureTrend = 'pad';
            else airPressureTrend = 'stabilan';
          }
          if (Array.isArray(data.recentHours) && data.recentHours.length > 0) {
            history = data.recentHours.map((r: any) => ({
              date: r.date,
              time: r.time,
              level: r.level,
              trendChange: r.trendChange
            }));
          }
          isLive = true;
        }
      }
    } catch {}

    // 3. Također dohvati izravno sa službenih stranica (mvodostaji.voda.hr, seatemperature.net, Yr.no, Ventusky)
    try {
      const [directHtml, directWaterTemp, yr, vPressure] = await Promise.all([
        fetchUniversalText(MVODOSTAJI_ALJMAS_URL),
        fetchDirectAljmasWaterTemp(),
        fetchDirectYrNoForecast('2-3244159'),
        fetchDirectVentuskyPressure(45.529, 18.95, '2-3244159')
      ]);

      if (directHtml) {
        const parsed = parseAljmasHtml(directHtml);
        if (parsed) {
          waterLevelCm = parsed.waterLevelCm;
          waterLevelTrend = parsed.waterLevelTrend;
          waterLevelChangeCm = parsed.waterLevelChangeCm;
          timeOfMeasurement = parsed.timeOfMeasurement;
          dateOfMeasurement = parsed.dateOfMeasurement;
          maxLevelCm = parsed.maxLevelCm;
          maxLevelDate = parsed.maxLevelDate;
          prepLevelCm = parsed.prepLevelCm;
          history = parsed.recentHistory;
          isLive = true;
        }
      }

      if (typeof directWaterTemp === 'number') {
        waterTempC = directWaterTemp;
      }

      if (yr && typeof yr.temperature === 'number') {
        airTempC = yr.temperature;
      }
      if (yr && typeof yr.pressure === 'number') {
        airPressureHpa = yr.pressure;
      }
      if (typeof vPressure === 'number') {
        airPressureHpa = vPressure;
      }
    } catch (err) {
      console.warn('Greška pri izravnom dohvatu Aljmaš podataka:', err);
    }

    if (airPressureHpa > 1019) airPressureTrend = 'rast';
    else if (airPressureHpa < 1012) airPressureTrend = 'pad';
    else airPressureTrend = 'stabilan';
  }

  const result: StationWaterData = {
    id: 'aljmas',
    name: 'Dunav - Aljmaš (Ušće Drave)',
    river: 'Dunav',
    sectorName: 'Sektor 2 / Ušće Drave u Dunav (Šporanj)',
    riverKm: 'rkm 1380,300',
    waterLevelCm,
    waterLevelTrend,
    waterLevelChangeCm,
    timeOfMeasurement,
    dateOfMeasurement,
    maxLevelCm,
    maxLevelDate,
    prepLevelCm,
    recentHistory: history,
    airPressureHpa,
    airPressureTrend,
    airTempC,
    waterTempC,
    windSpeedKmh: meteo.windSpeedKmh,
    windSpeedMs: meteo.windSpeedMs,
    windDirection: meteo.windDirection,
    weatherCondition: meteo.weatherCondition,
    sourceUrl: MVODOSTAJI_ALJMAS_URL,
    sourceName: 'mvodostaji.voda.hr (postaja 1582 - Aljmaš)',
    isLive,
    notes: 'Službena hidrološka postaja Hrvatskih voda na rkm 1380,300 u Aljmašu. Tlak zraka s Ventusky (45.529;18.95), temperatura s Yr.no.'
  };

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CACHE_ALJMAS_KEY, JSON.stringify(result));
    }
  } catch {}

  return result;
}

/**
 * Dohvat službenih podataka za Bogojevo (hidmet.gov.rs + hm_id=42015 temp vode + Yr.no + Ventusky + Firestore sinkronizacija)
 */
export async function fetchBogojevoStationData(): Promise<StationWaterData> {
  const meteo = await fetchMeteoForCoords(45.5342, 19.1231);
  const cached = getStoredBogojevoData();

  let waterLevelCm = cached ? cached.waterLevelCm : -77;
  let waterLevelTrend: WaterTrend = cached ? cached.waterLevelTrend : 'opada';
  let waterLevelChangeCm = cached ? cached.waterLevelChangeCm : -3;
  let flowM3s = cached?.flowM3s !== undefined ? cached.flowM3s : 1010;
  let forecastDays: number[] = cached?.forecastDays || [-78, -76, -72, -74];
  let regularDefenseCm = cached?.regularDefenseCm || 600;
  let emergencyDefenseCm = cached?.emergencyDefenseCm || 700;
  let airTempC = cached?.airTempC ?? 9.3;
  let waterTempC = cached?.waterTempC ?? 8.1;
  let isLive = Boolean(cached?.isLive);
  let timeOfMeasurement = cached?.timeOfMeasurement || '07:00';
  let dateOfMeasurement = cached?.dateOfMeasurement || new Date().toLocaleDateString('hr-HR');
  let airPressureHpa = meteo.airPressureHpa;
  let airPressureTrend: PressureTrend = meteo.airPressureTrend;

  let fetchedFromBackend = false;

  // 1. Pokušaj dohvata preko poslužitelja (u web pregledniku)
  try {
    const isCapacitorNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
    if (!isCapacitorNative) {
      const res = await safeFetchJson<any>(getApiUrl('/api/water/bogojevo'));
      if (res.ok && res.data && res.data.waterLevelCm !== undefined && res.data.waterLevelCm !== -83) {
        const data = res.data;
        waterLevelCm = data.waterLevelCm;
        waterLevelChangeCm = data.waterLevelChangeCm !== undefined ? data.waterLevelChangeCm : waterLevelChangeCm;
        waterLevelTrend = data.waterLevelTrend || 'opada';
        flowM3s = data.flowM3s !== undefined ? data.flowM3s : 1010;
        forecastDays = data.forecastDays || forecastDays;
        regularDefenseCm = data.regularDefenseCm || 600;
        emergencyDefenseCm = data.emergencyDefenseCm || 700;
        if (data.airTempC !== undefined) airTempC = data.airTempC;
        if (data.waterTempC !== undefined) waterTempC = data.waterTempC;
        if (data.airPressureHpa !== undefined) {
          airPressureHpa = data.airPressureHpa;
          if (airPressureHpa > 1019) airPressureTrend = 'rast';
          else if (airPressureHpa < 1012) airPressureTrend = 'pad';
          else airPressureTrend = 'stabilan';
        }
        isLive = Boolean(data.isLive);
        fetchedFromBackend = true;
      }
    }
  } catch {}

  // 2. Provjeri Firestore sinkronizirane podatke poslužitelja (water_stations/bogojevo) kako bi mobitel i računalo bili 100% identični
  if (!fetchedFromBackend) {
    try {
      const snap = await Promise.race([
        getDoc(doc(db, 'water_stations', 'bogojevo')),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 3500))
      ]);
      if (snap && (snap as any).exists && (snap as any).exists()) {
        const data = (snap as any).data();
        if (data && typeof data.waterLevelCm === 'number') {
          waterLevelCm = data.waterLevelCm;
          waterLevelChangeCm = data.waterLevelChangeCm !== undefined ? data.waterLevelChangeCm : waterLevelChangeCm;
          waterLevelTrend = data.waterLevelTrend || 'opada';
          flowM3s = data.flowM3s !== undefined ? data.flowM3s : flowM3s;
          forecastDays = data.forecastDays || forecastDays;
          if (typeof data.airTempC === 'number') airTempC = data.airTempC;
          if (typeof data.waterTempC === 'number') waterTempC = data.waterTempC;
          if (typeof data.airPressureHpa === 'number') {
            airPressureHpa = data.airPressureHpa;
            if (airPressureHpa > 1019) airPressureTrend = 'rast';
            else if (airPressureHpa < 1012) airPressureTrend = 'pad';
            else airPressureTrend = 'stabilan';
          }
          isLive = true;
        }
      }
    } catch {}

    // 3. Također dohvati izravno sa službenih RHMZ / Yr.no / Ventusky stranica
    try {
      const [directHtml, directWaterTemp, yr, vPressure] = await Promise.all([
        fetchUniversalText(HIDMET_BOGOJEVO_URL),
        fetchDirectBogojevoWaterTemp(),
        fetchDirectYrNoForecast('2-12503703'),
        fetchDirectVentuskyPressure(45.53, 19.13, '2-12503703')
      ]);

      if (directHtml) {
        const parsed = parseBogojevoHtml(directHtml);
        if (parsed) {
          waterLevelCm = parsed.waterLevelCm;
          waterLevelChangeCm = parsed.waterLevelChangeCm;
          waterLevelTrend = parsed.waterLevelTrend;
          flowM3s = parsed.flowM3s;
          forecastDays = parsed.forecastDays;
          isLive = true;
        }
      }

      if (typeof directWaterTemp === 'number') {
        waterTempC = directWaterTemp;
      }

      if (yr && typeof yr.temperature === 'number') {
        airTempC = yr.temperature;
      }
      if (yr && typeof yr.pressure === 'number') {
        airPressureHpa = yr.pressure;
      }
      if (typeof vPressure === 'number') {
        airPressureHpa = vPressure;
      }
    } catch (err) {
      console.warn('Greška pri izravnom dohvatu Bogojevo podataka:', err);
    }

    if (airPressureHpa > 1019) airPressureTrend = 'rast';
    else if (airPressureHpa < 1012) airPressureTrend = 'pad';
    else airPressureTrend = 'stabilan';
  }

  const history: WaterLevelHistoryItem[] = cached?.recentHistory && cached.recentHistory.length > 0
    ? cached.recentHistory
    : [
      { date: dateOfMeasurement, time: 'Danas 07:00', level: waterLevelCm, trendChange: waterLevelChangeCm },
      { date: 'Jučer', time: '07:00', level: waterLevelCm - waterLevelChangeCm, trendChange: 4 },
      { date: 'Prekjučer', time: '07:00', level: waterLevelCm - waterLevelChangeCm - 4, trendChange: -2 }
    ];

  const result: StationWaterData = {
    id: 'bogojevo',
    name: 'Dunav - Bogojevo',
    river: 'Dunav',
    sectorName: 'Most Bogojevo - Erdut / Regulacija Dunava',
    riverKm: 'rkm 1367,000',
    waterLevelCm,
    waterLevelTrend,
    waterLevelChangeCm,
    flowM3s,
    forecastDays,
    regularDefenseCm,
    emergencyDefenseCm,
    timeOfMeasurement,
    dateOfMeasurement,
    recentHistory: history,
    airPressureHpa,
    airPressureTrend,
    airTempC,
    waterTempC,
    windSpeedKmh: meteo.windSpeedKmh,
    windSpeedMs: meteo.windSpeedMs,
    windDirection: meteo.windDirection,
    weatherCondition: meteo.weatherCondition,
    sourceUrl: HIDMET_BOGOJEVO_URL,
    sourceName: 'hidmet.gov.rs (hm_id 42020)',
    isLive,
    notes: 'Službena RHMZ postaja s prognozom, protokom i granicama obrane od poplava. Tlak zraka s Ventusky (45.53;19.13), temperatura s Yr.no.'
  };

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CACHE_BOGOJEVO_KEY, JSON.stringify(result));
    }
  } catch {}

  return result;
}
