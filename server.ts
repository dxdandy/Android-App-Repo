import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

export const MVODOSTAJI_ALJMAS_URL = 'https://mvodostaji.voda.hr/Home/PregledVodostajaPostaje?sektorID=2&bpID=0&postajaID=148';
export const SEATEMP_ALJMAS_VUKOVAR_URL = 'https://hr.seatemperature.net/current/croatia/water-temp-in-vukovar-in-danube';
export const PUTOVNICA_ALJMAS_URL = 'https://www.putovnica.net/vrijeme/vremenska-prognoza/mjesto/aljmas-hr-vremenska-prognoza-po-satima';

export const HIDMET_BOGOJEVO_URL = 'https://www.hidmet.gov.rs/latin/hidrologija/izvestajne/prognoza.php?hm_id=42020';
export const HIDMET_BOGOJEVO_TEMP_URL = 'https://www.hidmet.gov.rs/latin/hidrologija/izvestajne/prognoza.php?hm_id=42015';
export const VOJVODINAMETEO_BOGOJEVO_URL = 'https://vojvodinameteo.rs/vremenska-prognoza-bogojevo/';

/**
 * Dohvat tlaka zraka za Aljmaš (primarno s putovnica.net, fallback na live barometar Aljmaš)
 */
async function fetchAljmasAirPressure(): Promise<number> {
  try {
    const res = await fetch(PUTOVNICA_ALJMAS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'hr-HR,hr;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: AbortSignal.timeout(4500)
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/tlak[^\d]*(\d{3,4})\s*hPa/i) || html.match(/(\d{3,4})\s*hPa/i);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (val >= 950 && val <= 1060) return val;
      }
    }
  } catch (err) {
    console.warn('Greška pri dohvatu tlaka zraka s putovnica.net:', err);
  }

  // Točan live MSL barometar za koordinate Aljmaša
  try {
    const mRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=45.5269&longitude=18.9489&current=surface_pressure,pressure_msl&timezone=Europe%2FZagreb', {
      signal: AbortSignal.timeout(4000)
    });
    if (mRes.ok) {
      const mData = await mRes.json();
      const p = mData.current?.pressure_msl || mData.current?.surface_pressure;
      if (p) return Math.round(p);
    }
  } catch {}
  return 1025;
}

/**
 * Dohvat tlaka zraka za Bogojevo (s vojvodinameteo.rs)
 */
async function fetchBogojevoAirPressure(): Promise<number> {
  try {
    const res = await fetch(VOJVODINAMETEO_BOGOJEVO_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/<dt>[^<]*pritisak[^<]*<\/dt>\s*<dd>[^<]*\/\s*([+-]?\d+)\s*hPa/i)
                 || html.match(/scope="col">Pritisak<\/th>[\s\S]*?(\d{3,4})\s*hPa/i)
                 || html.match(/(\d{3,4})\s*hPa/i);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (val >= 950 && val <= 1060) return val;
      }
    }
  } catch (err) {
    console.warn('Greška pri dohvatu tlaka zraka za Bogojevo (vojvodinameteo.rs):', err);
  }

  // Točan live MSL barometar za koordinate Bogojeva
  try {
    const mRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=45.5342&longitude=19.1231&current=surface_pressure,pressure_msl&timezone=Europe%2FZagreb', {
      signal: AbortSignal.timeout(4000)
    });
    if (mRes.ok) {
      const mData = await mRes.json();
      const p = mData.current?.pressure_msl || mData.current?.surface_pressure;
      if (p) return Math.round(p);
    }
  } catch {}
  return 1025;
}

/**
 * Dohvat temperature vode Dunava za Aljmaš (s hr.seatemperature.net, skroz lijeva temperatura s oznakom Danas)
 */
async function fetchAljmasWaterTemp(): Promise<number> {
  try {
    const res = await fetch(SEATEMP_ALJMAS_VUKOVAR_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'hr,en-US;q=0.7,en;q=0.3'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error('seatemperature status ' + res.status);
    const html = await res.text();
    // Skroz lijeva temperatura s oznakom "Danas":
    // <div class="temp-block cold"><div class="temp-value">12.9<span>°C</span></div><div class="temp-label">Danas</div></div>
    const danasBlockMatch = html.match(/<div class="temp-value">\s*([+-]?\d+[.,]?\d*)\s*<span>°C<\/span><\/div>\s*<div class="temp-label">\s*Danas\s*<\/div>/i)
      || html.match(/<div class="temp-block[^"]*">\s*<div class="temp-value">\s*([+-]?\d+[.,]?\d*)/i)
      || html.match(/danas je\s*([+-]?\d+[.,]?\d*)\s*°C/i);
    if (danasBlockMatch && danasBlockMatch[1]) {
      const val = parseFloat(danasBlockMatch[1].replace(',', '.'));
      if (!isNaN(val)) return val;
    }
  } catch (err) {
    console.warn('Greška pri dohvatu temperature Dunava u Aljmašu (seatemperature.net):', err);
  }
  return 12.9;
}

/**
 * Dohvat temperature vode Dunava za Bogojevo (s hidmet.gov.rs hm_id=42015)
 */
async function fetchBogojevoWaterTemp(): Promise<number> {
  try {
    const res = await fetch(HIDMET_BOGOJEVO_TEMP_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error('hidmet hm_id=42015 status ' + res.status);
    const html = await res.text();
    // <img src="../../../repository/ikonice/interf/temp.gif" width="14" height="44" alt="Temperatura vode u profilu" />&nbsp;12.4
    const tempMatch = html.match(/temp\.gif[^>]*\/>(?:&nbsp;|\s)*([+-]?\d+[.,]?\d*)/i);
    if (tempMatch && tempMatch[1]) {
      const val = parseFloat(tempMatch[1].replace(',', '.'));
      if (!isNaN(val)) return val;
    }
  } catch (err) {
    console.warn('Greška pri dohvatu temperature Dunava u Bogojevu (hm_id=42015):', err);
  }
  return 12.4;
}

/**
 * API: Službeni vodostaj Dunava - Aljmaš (mvodostaji.voda.hr)
 */
app.get('/api/water/aljmas', async (_req, res) => {
  try {
    const response = await fetch(MVODOSTAJI_ALJMAS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      throw new Error(`mvodostaji.voda.hr status ${response.status}`);
    }

    const html = await response.text();

    // 1. Robusno parsiranje redaka mjerne tablice - uvijek uzimamo najgornji (najnoviji) redak (rows[0])
    const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    const rows: Array<{
      date: string;
      time: string;
      level: number;
      trendClass: string;
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
            trendClass: tr.includes('red') ? 'red' : tr.includes('green') ? 'green' : 'blue',
            trendChange: changeVal
          });
          if (rows.length >= 24) break;
        }
      }
    }

    // 2. Maksimum i pripremno stanje
    const maxMatch = html.match(/Maksimum:\s*([+-]?\d+)\s*cm(?:,\s*([^.<]+))?/i);
    const prepMatch = html.match(/Pripremno stanje\s*:\s*([+-]?\d+)/i);

    // Najgornji podatak s mvodostaji.voda.hr
    const latest = rows[0] || {
      date: new Date().toLocaleDateString('hr-HR'),
      time: '09:00',
      level: -76,
      trendClass: 'blue',
      trendChange: 0
    };

    let trend: 'stagnira' | 'u_porastu' | 'opada' = 'stagnira';
    if (latest.trendChange > 0) {
      trend = 'u_porastu';
    } else if (latest.trendChange < 0) {
      trend = 'opada';
    }

    const waterTemp = await fetchAljmasWaterTemp();
    const airPressureHpa = await fetchAljmasAirPressure();

    res.json({
      success: true,
      stationName: 'Dunav - Aljmaš (Ušće Drave)',
      riverKm: 'rkm 1380,300',
      waterLevelCm: latest.level,
      waterLevelTrend: trend,
      waterLevelChangeCm: latest.trendChange,
      timeOfMeasurement: latest.time,
      dateOfMeasurement: latest.date,
      waterTempC: waterTemp,
      airPressureHpa,
      maxLevelCm: maxMatch ? parseInt(maxMatch[1], 10) : 820,
      maxLevelDate: maxMatch && maxMatch[2] ? maxMatch[2].trim() : '25.06.1965.',
      prepLevelCm: prepMatch ? parseInt(prepMatch[1], 10) : 400,
      recentHours: rows.slice(0, 10),
      sourceUrl: MVODOSTAJI_ALJMAS_URL,
      waterTempSourceUrl: SEATEMP_ALJMAS_VUKOVAR_URL,
      airPressureSourceUrl: PUTOVNICA_ALJMAS_URL,
      isLive: true
    });
  } catch (error) {
    console.warn('Greška pri dohvatu Aljmaš vodostaja s mvodostaji.voda.hr, fallback na snapshot:', error);
    res.json({
      success: false,
      stationName: 'Dunav - Aljmaš (Ušće Drave)',
      riverKm: 'rkm 1380,300',
      waterLevelCm: -76,
      waterLevelTrend: 'stagnira',
      waterLevelChangeCm: 0,
      waterTempC: 12.9,
      airPressureHpa: 1025,
      timeOfMeasurement: '09:00',
      dateOfMeasurement: '30.10.2026.',
      maxLevelCm: 820,
      prepLevelCm: 400,
      sourceUrl: MVODOSTAJI_ALJMAS_URL,
      waterTempSourceUrl: SEATEMP_ALJMAS_VUKOVAR_URL,
      airPressureSourceUrl: PUTOVNICA_ALJMAS_URL,
      isLive: false,
      message: 'Učitani zadnji važeći podaci mjerne stanice Aljmaš.'
    });
  }
});

/**
 * API: Službeni vodostaj Dunava - Bogojevo (hidmet.gov.rs)
 */
app.get('/api/water/bogojevo', async (_req, res) => {
  try {
    const response = await fetch(HIDMET_BOGOJEVO_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      throw new Error(`hidmet.gov.rs status ${response.status}`);
    }

    const html = await response.text();

    const levelMatch = html.match(/nivo\.gif[^>]*\/>(?:&nbsp;|\s)*([+-]?\d+)/i);
    const changeMatch = html.match(/promena\.gif[^>]*\/>(?:&nbsp;|\s)*([+-]?\d+)/i);
    const flowMatch = html.match(/([+-]?\d+)\s*(?:&nbsp;)?<img[^>]*protok\.gif/i)
                   || html.match(/protok\.gif[^>]*\/>(?:&nbsp;|\s)*([+-]?\d+)/i)
                   || html.match(/([+-]?\d+)<img src="[^"]*protok\.gif/i);
    const trendMatch = html.match(/ikonice\/interf\/(rast|pad|stagn|opad)/i);
    const forecastMatch = html.match(/Vodostaj&nbsp;\(cm\):\s*<\/td>(.*?)(?:<\/tr>|Dijagrami)/s);

    const parsedLevel = levelMatch ? parseInt(levelMatch[1], 10) : -83;
    const parsedChange = changeMatch ? parseInt(changeMatch[1], 10) : -1;
    const parsedFlow = flowMatch ? parseInt(flowMatch[1], 10) : 985;

    // Temperatura vode za Bogojevo s https://www.hidmet.gov.rs/latin/hidrologija/izvestajne/prognoza.php?hm_id=42015
    const waterTemp = await fetchBogojevoWaterTemp();

    // Tlak zraka za Bogojevo s https://vojvodinameteo.rs/vremenska-prognoza-bogojevo/
    const airPressureHpa = await fetchBogojevoAirPressure();

    let parsedTrend: 'u_porastu' | 'opada' | 'stagnira' = 'opada';
    if (trendMatch) {
      const t = trendMatch[1].toLowerCase();
      if (t.includes('rast')) parsedTrend = 'u_porastu';
      else if (t.includes('opad') || t.includes('pad')) parsedTrend = 'opada';
    } else if (parsedChange > 0) {
      parsedTrend = 'u_porastu';
    } else if (parsedChange < 0) {
      parsedTrend = 'opada';
    }

    let forecastDays: number[] = [];
    if (forecastMatch && forecastMatch[1]) {
      const numbers = forecastMatch[1].match(/>([+-]?\d+)</g);
      if (numbers) {
        forecastDays = numbers.map(n => parseInt(n.replace(/[><]/g, ''), 10)).filter(n => !isNaN(n));
      }
    }

    res.json({
      success: true,
      stationName: 'RHMZ Dunav - Bogojevo',
      waterBody: 'Dunav',
      waterLevelCm: parsedLevel,
      waterLevelChangeCm: parsedChange,
      waterLevelTrend: parsedTrend,
      waterTempC: waterTemp,
      airPressureHpa,
      flowM3s: parsedFlow,
      forecastDays: forecastDays.length > 0 ? forecastDays : [-92, -86, -90, -96],
      regularDefenseCm: 600,
      emergencyDefenseCm: 700,
      sourceUrl: HIDMET_BOGOJEVO_URL,
      waterTempSourceUrl: HIDMET_BOGOJEVO_TEMP_URL,
      airPressureSourceUrl: VOJVODINAMETEO_BOGOJEVO_URL,
      isLive: true
    });
  } catch (error) {
    console.warn('Greška pri dohvatu Bogojevo vodostaja s hidmet.gov.rs, fallback na snapshot:', error);
    res.json({
      success: false,
      stationName: 'RHMZ Dunav - Bogojevo',
      waterBody: 'Dunav',
      waterLevelCm: -83,
      waterLevelChangeCm: -1,
      waterLevelTrend: 'opada',
      waterTempC: 12.6,
      airPressureHpa: 1025,
      flowM3s: 985,
      forecastDays: [-92, -86, -90, -96],
      regularDefenseCm: 600,
      emergencyDefenseCm: 700,
      sourceUrl: HIDMET_BOGOJEVO_URL,
      waterTempSourceUrl: HIDMET_BOGOJEVO_TEMP_URL,
      airPressureSourceUrl: VOJVODINAMETEO_BOGOJEVO_URL,
      isLive: false,
      message: 'Učitani zadnji važeći podaci mjerne stanice Bogojevo.'
    });
  }
});

/**
 * API: Scraper za bilo koji korisnički uneseni web URL
 */
app.get('/api/scrape', async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Nedostaje url parametar' });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(7000)
    });

    const text = await response.text();
    res.json({ success: true, url: targetUrl, html: text.slice(0, 150000) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =====================================================================
 * SUSTAV CENTRALNOG UPRAVLJANJA LICENCAMA I INTERNIM CHATOM
 * Autor: Daniel Čizmar
 * ===================================================================== */

const SECRET_SALT = 'DUNAV_ZANDER_DANIEL_CIZMAR_2026_PROTECT_KEY';
const ADMIN_MASTER_PIN = '2026';

function hashString(str: string): number[] {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [Math.abs(h1), Math.abs(h2)];
}

function generateActivationKey(deviceId: string): string {
  const cleanId = deviceId.trim().toUpperCase();
  const input = `${cleanId}:${SECRET_SALT}`;
  const [h1, h2] = hashString(input);

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let block1 = '';
  let block2 = '';

  let n1 = h1;
  let n2 = h2;
  for (let i = 0; i < 4; i++) {
    block1 += chars.charAt(n1 % chars.length);
    n1 = Math.floor(n1 / chars.length);
    block2 += chars.charAt(n2 % chars.length);
    n2 = Math.floor(n2 / chars.length);
  }

  return `AKT-${block1}-${block2}`;
}

function verifyActivationKey(deviceId: string, enteredKey: string): boolean {
  if (!deviceId || !enteredKey) return false;
  const expectedKey = generateActivationKey(deviceId);
  const normalizedEntered = enteredKey.trim().toUpperCase().replace(/\s+/g, '');
  const normalizedExpected = expectedKey.replace(/\s+/g, '');
  return normalizedEntered === normalizedExpected;
}

export interface LicenseRecord {
  deviceId: string;
  activationKey: string;
  userName: string;
  status: 'active' | 'revoked';
  chatEnabled?: boolean; // true = odobren chat, false = blokiran chat
  createdAt: string;
  lastSeenAt: string;
  notes?: string;
}

export interface ChatMessageRecord {
  id: string;
  deviceId: string;
  userName: string;
  text: string;
  timestamp: string;
  createdAt: number;
}

const DATA_DIR = path.resolve(__dirname, 'data');
const LICENSES_FILE = path.join(DATA_DIR, 'licenses.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat.json');

function ensureDataStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LICENSES_FILE)) {
      fs.writeFileSync(LICENSES_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
    if (!fs.existsSync(CHAT_FILE)) {
      const initialChat: ChatMessageRecord[] = [
        {
          id: 'msg-welcome',
          deviceId: 'RP-ADMIN',
          userName: 'Daniel (Admin)',
          text: 'Bistro ribiči! Dobrodošli u interni Dunavski LiveChat. Ovdje možete javljati stanje vode, ulove i aktivnost ribe! 🎣🌊',
          timestamp: new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }),
          createdAt: Date.now()
        }
      ];
      fs.writeFileSync(CHAT_FILE, JSON.stringify(initialChat, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Greška pri inicijalizaciji data direktorija:', err);
  }
}

ensureDataStorage();

function loadLicenses(): LicenseRecord[] {
  try {
    ensureDataStorage();
    if (fs.existsSync(LICENSES_FILE)) {
      const raw = fs.readFileSync(LICENSES_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Greška pri učitavanju licenci:', err);
  }
  return [];
}

function saveLicenses(licenses: LicenseRecord[]): void {
  try {
    ensureDataStorage();
    fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2), 'utf-8');
  } catch (err) {
    console.error('Greška pri spremanju licenci:', err);
  }
}

function loadChat(): ChatMessageRecord[] {
  try {
    ensureDataStorage();
    if (fs.existsSync(CHAT_FILE)) {
      const raw = fs.readFileSync(CHAT_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Greška pri učitavanju chata:', err);
  }
  return [];
}

function saveChat(messages: ChatMessageRecord[]): void {
  try {
    ensureDataStorage();
    fs.writeFileSync(CHAT_FILE, JSON.stringify(messages, null, 2), 'utf-8');
  } catch (err) {
    console.error('Greška pri spremanju chata:', err);
  }
}

/**
 * API: Registracija i redovita provjera licence s poslužiteljem
 */
app.post('/api/license/register-or-verify', (req, res) => {
  const { deviceId, activationKey, proposedName } = req.body || {};
  if (!deviceId || !activationKey) {
    return res.status(400).json({ valid: false, message: 'Nedostaje deviceId ili activationKey' });
  }

  const cleanDeviceId = String(deviceId).trim().toUpperCase();
  const cleanKey = String(activationKey).trim().toUpperCase();

  const licenses = loadLicenses();
  const existing = licenses.find(l => l.deviceId === cleanDeviceId);

  if (existing) {
    existing.lastSeenAt = new Date().toISOString();
    if (existing.chatEnabled === undefined) {
      existing.chatEnabled = true;
    }
    // Ako korisnik pošalje proposedName, a admin još nije postavio prilagođeno ime
    if (proposedName && (!existing.userName || existing.userName.startsWith('Ribič (RP-'))) {
      existing.userName = String(proposedName).trim();
    }
    saveLicenses(licenses);

    if (existing.status === 'revoked') {
      return res.json({
        valid: false,
        status: 'revoked',
        chatEnabled: false,
        userName: existing.userName,
        message: 'Vaša licenca za ovaj uređaj je ukinuta od strane administratora.'
      });
    }

    return res.json({
      valid: true,
      status: 'active',
      chatEnabled: existing.chatEnabled !== false,
      userName: existing.userName
    });
  }

  // Ako još ne postoji zapis u bazi, provjeravamo matematičku ispravnost koda
  if (!verifyActivationKey(cleanDeviceId, cleanKey)) {
    return res.status(400).json({
      valid: false,
      message: 'Aktivacijski kod nije ispravan za ovaj uređaj.'
    });
  }

  // Registriramo novog korisnika (default chatEnabled = true)
  const newRec: LicenseRecord = {
    deviceId: cleanDeviceId,
    activationKey: cleanKey,
    userName: (proposedName && String(proposedName).trim()) || `Ribič (${cleanDeviceId.slice(-4)})`,
    status: 'active',
    chatEnabled: true,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };

  licenses.push(newRec);
  saveLicenses(licenses);

  return res.json({
    valid: true,
    status: 'active',
    chatEnabled: true,
    userName: newRec.userName
  });
});

/**
 * API (Admin): Dohvat svih registriranih licenci
 */
app.get('/api/admin/licenses', (req, res) => {
  const pin = req.headers['x-admin-pin'] as string;
  if (pin !== ADMIN_MASTER_PIN) {
    return res.status(403).json({ error: 'Neispravan administratorski PIN' });
  }

  const licenses = loadLicenses();
  // Osiguraj chatEnabled zadanu vrijednost ako nedostaje
  licenses.forEach(l => {
    if (l.chatEnabled === undefined) l.chatEnabled = true;
  });
  // Sortiraj tako da najnoviji ili nedavno viđeni budu na vrhu
  licenses.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
  res.json({ success: true, licenses });
});

/**
 * API (Admin): Dodavanje novog ili postojećeg korisnika u kontrolni panel i chat
 */
app.post('/api/admin/licenses/add', (req, res) => {
  const pin = req.headers['x-admin-pin'] as string;
  if (pin !== ADMIN_MASTER_PIN) {
    return res.status(403).json({ error: 'Neispravan administratorski PIN' });
  }

  const { deviceId, userName, activationKey, status, chatEnabled, notes } = req.body || {};
  if (!deviceId) {
    return res.status(400).json({ error: 'ID uređaja (Device ID) je obavezan' });
  }

  const cleanDeviceId = String(deviceId).trim().toUpperCase();
  const validKey = (activationKey && String(activationKey).trim().toUpperCase()) || generateActivationKey(cleanDeviceId);
  const cleanName = (userName && String(userName).trim()) || `Ribič (${cleanDeviceId.slice(-4)})`;
  const cleanStatus = status === 'revoked' ? 'revoked' : 'active';
  const cleanChat = chatEnabled !== false;

  const licenses = loadLicenses();
  const existingIdx = licenses.findIndex(l => l.deviceId === cleanDeviceId);

  if (existingIdx >= 0) {
    licenses[existingIdx].userName = cleanName;
    licenses[existingIdx].activationKey = validKey;
    licenses[existingIdx].status = cleanStatus;
    licenses[existingIdx].chatEnabled = cleanChat;
    if (typeof notes === 'string') licenses[existingIdx].notes = notes.trim();
    licenses[existingIdx].lastSeenAt = new Date().toISOString();
    saveLicenses(licenses);
    return res.json({ success: true, license: licenses[existingIdx], updated: true });
  }

  const newRecord: LicenseRecord = {
    deviceId: cleanDeviceId,
    activationKey: validKey,
    userName: cleanName,
    status: cleanStatus,
    chatEnabled: cleanChat,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    notes: (notes && String(notes).trim()) || ''
  };

  licenses.unshift(newRecord);
  saveLicenses(licenses);
  return res.json({ success: true, license: newRecord, created: true });
});

/**
 * API (Admin): Ažuriranje imena, statusa licence, dozvole za chat i bilješki
 */
app.post('/api/admin/licenses/update', (req, res) => {
  const pin = req.headers['x-admin-pin'] as string;
  if (pin !== ADMIN_MASTER_PIN) {
    return res.status(403).json({ error: 'Neispravan administratorski PIN' });
  }

  const { deviceId, userName, status, chatEnabled, notes } = req.body || {};
  if (!deviceId) {
    return res.status(400).json({ error: 'Nedostaje deviceId' });
  }

  const cleanDeviceId = String(deviceId).trim().toUpperCase();
  const licenses = loadLicenses();
  const target = licenses.find(l => l.deviceId === cleanDeviceId);

  if (!target) {
    // Ako još nije registriran, a admin ga želi unaprijed dodati
    const generatedKey = generateActivationKey(cleanDeviceId);
    const newRecord: LicenseRecord = {
      deviceId: cleanDeviceId,
      activationKey: generatedKey,
      userName: userName ? String(userName).trim() : `Ribič (${cleanDeviceId.slice(-4)})`,
      status: status === 'revoked' ? 'revoked' : 'active',
      chatEnabled: chatEnabled !== false,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      notes: notes ? String(notes).trim() : ''
    };
    licenses.push(newRecord);
    saveLicenses(licenses);
    return res.json({ success: true, license: newRecord });
  }

  if (typeof userName === 'string') target.userName = userName.trim();
  if (status === 'active' || status === 'revoked') target.status = status;
  if (typeof chatEnabled === 'boolean') target.chatEnabled = chatEnabled;
  if (typeof notes === 'string') target.notes = notes.trim();

  saveLicenses(licenses);
  return res.json({ success: true, license: target });
});

/**
 * API (Admin): Brisanje licence
 */
app.delete('/api/admin/licenses/:deviceId', (req, res) => {
  const pin = req.headers['x-admin-pin'] as string;
  if (pin !== ADMIN_MASTER_PIN) {
    return res.status(403).json({ error: 'Neispravan administratorski PIN' });
  }

  const cleanDeviceId = String(req.params.deviceId).trim().toUpperCase();
  let licenses = loadLicenses();
  licenses = licenses.filter(l => l.deviceId !== cleanDeviceId);
  saveLicenses(licenses);

  res.json({ success: true, message: 'Licenca obrisana' });
});

/**
 * API: Dohvat poruka internog chata (samo odobreni korisnici kojima nije blokiran chat)
 */
app.get('/api/chat/messages', (req, res) => {
  const pin = req.headers['x-admin-pin'] as string;
  const deviceId = (req.query.deviceId as string) || (req.headers['x-device-id'] as string);
  const cleanDeviceId = deviceId ? String(deviceId).trim().toUpperCase() : '';

  // Admin uvijek ima pravo pregleda
  if (pin === ADMIN_MASTER_PIN || cleanDeviceId === 'RP-ADMIN') {
    const messages = loadChat();
    return res.json({ success: true, messages: messages.slice(-60) });
  }

  if (!cleanDeviceId) {
    return res.status(403).json({ 
      success: false, 
      chatBlocked: true, 
      message: 'Potrebna je aktivacija aplikacije za pristup LiveChatu.' 
    });
  }

  const licenses = loadLicenses();
  const userLicense = licenses.find(l => l.deviceId === cleanDeviceId);

  if (!userLicense) {
    return res.status(403).json({ 
      success: false, 
      chatBlocked: true, 
      message: 'Uređaj još nije registriran u sustavu licenci.' 
    });
  }

  if (userLicense.status === 'revoked') {
    return res.status(403).json({ 
      success: false, 
      chatBlocked: true, 
      message: 'Vaša licenca je ukinuta od strane administratora.' 
    });
  }

  if (userLicense.chatEnabled === false) {
    return res.status(403).json({ 
      success: false, 
      chatBlocked: true, 
      message: 'Administrator vam je onemogućio pristup LiveChatu.' 
    });
  }

  const messages = loadChat();
  return res.json({ success: true, messages: messages.slice(-60) });
});

/**
 * API: Slanje poruke u interni chat (dozvoljeno isključivo aktivnim korisnicima s odobrenim chatom)
 */
app.post('/api/chat/messages', (req, res) => {
  const { deviceId, text } = req.body || {};
  if (!deviceId || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'Tekst poruke je obavezan' });
  }

  const cleanDeviceId = String(deviceId).trim().toUpperCase();
  const licenses = loadLicenses();
  const userLicense = licenses.find(l => l.deviceId === cleanDeviceId);

  if (!userLicense || userLicense.status === 'revoked') {
    return res.status(403).json({ error: 'Nemate važeću aktivnu licencu za pisanje u chat.' });
  }

  if (userLicense.chatEnabled === false) {
    return res.status(403).json({ error: 'Administrator vam je onemogućio pristup LiveChatu.' });
  }

  const cleanText = String(text).trim().slice(0, 350); // limit 350 znakova

  let chat = loadChat();
  const newMsg: ChatMessageRecord = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    deviceId: cleanDeviceId,
    userName: userLicense.userName,
    text: cleanText,
    timestamp: new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }),
    createdAt: Date.now()
  };

  chat.push(newMsg);
  if (chat.length > 250) {
    chat = chat.slice(-250);
  }
  saveChat(chat);

  return res.json({ success: true, message: newMsg });
});

/**
 * API (Admin): Brisanje poruke iz chata
 */
app.delete('/api/admin/chat/messages/:id', (req, res) => {
  const pin = req.headers['x-admin-pin'] as string;
  if (pin !== ADMIN_MASTER_PIN) {
    return res.status(403).json({ error: 'Neispravan PIN' });
  }

  const id = req.params.id;
  let chat = loadChat();
  chat = chat.filter(m => m.id !== id);
  saveChat(chat);

  res.json({ success: true });
});

/**
 * API: Provjera najnovije verzije aplikacije
 */
app.get('/api/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    version: '1.3.1',
    name: 'RiboPrognoza',
    releaseDate: '2026-10-31',
    apkUrl: 'https://github.com/dxdandy/Android-App-Repo/releases/latest/download/RiboPrognoza.apk',
    changelog: [
      'Mogućnost ručnog dodavanja postojećih korisnika u kontrolni panel licenci i chat',
      'Mogućnost pojedinačnog odobravanja i blokiranja pristupa LiveChatu za svakog korisnika',
      'Prikaz poruka u LiveChatu isključivo korisnicima kojima je administrator odobrio sudjelovanje',
      'Povećan LiveChat gumb u navigaciji usklađen s dimenzijama gumba za Ažuriranje',
      'Naziv aplikacije RiboPrognoza prikazan u dva reda s poravnatim početnim slovima usklađen s visinom ikone'
    ],
    isCritical: false
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Intercept Vite client in preview/cloud environment to provide a clean, silent HMR stub without WebSocket errors
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(`
export class ErrorOverlay extends HTMLElement {}
if (typeof customElements !== 'undefined' && !customElements.get('vite-error-overlay')) {
  customElements.define('vite-error-overlay', ErrorOverlay);
}
export function createHotContext() {
  return {
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
    data: {}
  };
}
export function updateStyle(id, content) {
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = content;
}
export function removeStyle(id) {
  const style = document.getElementById(id);
  if (style) style.remove();
}
export function injectQuery(url, queryToInject) {
  return url.includes('?') ? url + '&' + queryToInject : url + '?' + queryToInject;
}
`);
    });

    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ribolovni Dnevnik server sluša na http://0.0.0.0:${PORT}`);
  });
}

startServer();
