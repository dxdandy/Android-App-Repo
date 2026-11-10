import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, query, orderBy, limitToLast } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Omogući CORS za sve rute kako Android WebView i vanjski klijenti ne bi dobili "Failed to fetch"
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-pin, x-device-id');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

export const MVODOSTAJI_ALJMAS_URL = 'https://mvodostaji.voda.hr/Home/PregledVodostajaPostaje?sektorID=2&bpID=34&postajaID=1582';
export const SEATEMP_ALJMAS_VUKOVAR_URL = 'https://hr.seatemperature.net/current/croatia/water-temp-in-vukovar-in-danube';
export const VENTUSKY_ALJMAS_URL = 'https://www.ventusky.com/45.529;18.95';
export const YR_ALJMAS_URL = 'https://www.yr.no/en/forecast/daily-table/2-3244159/Croatia/Vukovar-Srijem%20County/Aljmas';

export const HIDMET_BOGOJEVO_URL = 'https://www.hidmet.gov.rs/latin/hidrologija/izvestajne/prognoza.php?hm_id=42020';
export const HIDMET_BOGOJEVO_TEMP_URL = 'https://www.hidmet.gov.rs/latin/hidrologija/izvestajne/prognoza.php?hm_id=42015';
export const VENTUSKY_BOGOJEVO_URL = 'https://www.ventusky.com/45.53;19.13';
export const YR_BOGOJEVO_URL = 'https://www.yr.no/en/forecast/daily-table/2-12503703/Serbia/Vojvodina/West%20Ba%C4%8Dka%20District/Bogojevo%20border%20checkpoint';

/**
 * Dohvat temperature zraka za Aljmaš s Yr.no (lokacija 2-3244159)
 */
async function fetchAljmasAirTemp(): Promise<number> {
  try {
    const res = await fetch('https://www.yr.no/api/v0/locations/2-3244159/forecast', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.shortIntervals) && data.shortIntervals.length > 0) {
        const val = data.shortIntervals[0].temperature?.value;
        if (typeof val === 'number') return Math.round(val * 10) / 10;
      }
      if (Array.isArray(data.dayIntervals) && data.dayIntervals.length > 0) {
        const val = data.dayIntervals[0].temperature?.value;
        if (typeof val === 'number') return Math.round(val * 10) / 10;
      }
    }
  } catch (err) {
    console.warn('Greška pri dohvatu temperature s Yr.no (Aljmaš):', err);
  }

  // Službeni Met.no model kao pouzdan fallback
  try {
    const mRes = await fetch('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=45.5269&lon=18.9489', {
      headers: { 'User-Agent': 'RiboPrognozaDunav/1.4 github.com/dxdandy' },
      signal: AbortSignal.timeout(4000)
    });
    if (mRes.ok) {
      const mData = await mRes.json();
      const val = mData.properties?.timeseries?.[0]?.data?.instant?.details?.air_temperature;
      if (typeof val === 'number') return Math.round(val * 10) / 10;
    }
  } catch {}
  return 9.9;
}

/**
 * Dohvat temperature zraka za Bogojevo s Yr.no (lokacija 2-12503703)
 */
async function fetchBogojevoAirTemp(): Promise<number> {
  try {
    const res = await fetch('https://www.yr.no/api/v0/locations/2-12503703/forecast', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.shortIntervals) && data.shortIntervals.length > 0) {
        const val = data.shortIntervals[0].temperature?.value;
        if (typeof val === 'number') return Math.round(val * 10) / 10;
      }
      if (Array.isArray(data.dayIntervals) && data.dayIntervals.length > 0) {
        const val = data.dayIntervals[0].temperature?.value;
        if (typeof val === 'number') return Math.round(val * 10) / 10;
      }
    }
  } catch (err) {
    console.warn('Greška pri dohvatu temperature s Yr.no (Bogojevo):', err);
  }

  // Službeni Met.no model kao pouzdan fallback
  try {
    const mRes = await fetch('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=45.5342&lon=19.1231', {
      headers: { 'User-Agent': 'RiboPrognozaDunav/1.4 github.com/dxdandy' },
      signal: AbortSignal.timeout(4000)
    });
    if (mRes.ok) {
      const mData = await mRes.json();
      const val = mData.properties?.timeseries?.[0]?.data?.instant?.details?.air_temperature;
      if (typeof val === 'number') return Math.round(val * 10) / 10;
    }
  } catch {}
  return 10.4;
}

/**
 * Dohvat tlaka zraka za Aljmaš s Ventusky (https://www.ventusky.com/45.529;18.95)
 */
async function fetchAljmasAirPressure(): Promise<number> {
  try {
    const res = await fetch(VENTUSKY_ALJMAS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'hr-HR,hr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cookie': 'units=m; p=hpa;'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const html = await res.text();
      // Izvuci točnu vrijednost tlaka iz tablice Ventusky
      const tableMatch = html.match(/(?:Tlak zraka|Air pressure|Pressure)[^<]*<\/td>\s*<td[^>]*>\s*<b>\s*(\d{3,4})\s*(?:&nbsp;|\s)*hPa/i)
        || html.match(/<b>\s*(\d{3,4})\s*(?:&nbsp;|\s)*hPa\s*<\/b>/i)
        || html.match(/(\d{3,4})\s*(?:&nbsp;|\s)*hPa/i);
      if (tableMatch && tableMatch[1]) {
        const val = parseInt(tableMatch[1], 10);
        if (val >= 940 && val <= 1065) return val;
      }
      // Provjera ako je u inHg jedinicama
      const inHgMatch = html.match(/(?:Tlak zraka|Air pressure)[^<]*<\/td>\s*<td[^>]*>\s*<b>\s*(\d+(?:\.\d+)?)\s*(?:&nbsp;|\s)*inHg/i);
      if (inHgMatch && inHgMatch[1]) {
        const inhg = parseFloat(inHgMatch[1]);
        if (!isNaN(inhg)) return Math.round(inhg * 33.8639);
      }
    }
  } catch (err) {
    console.warn('Greška pri dohvatu tlaka zraka s Ventusky (Aljmaš):', err);
  }

  // Točan live MSL barometar za koordinate Aljmaša kao automatski fallback
  try {
    const mRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=45.529&longitude=18.95&current=surface_pressure,pressure_msl&timezone=Europe%2FZagreb', {
      signal: AbortSignal.timeout(4000)
    });
    if (mRes.ok) {
      const mData = await mRes.json();
      const p = mData.current?.pressure_msl || mData.current?.surface_pressure;
      if (p) return Math.round(p);
    }
  } catch {}
  return 1021;
}

/**
 * Dohvat tlaka zraka za Bogojevo s Ventusky (https://www.ventusky.com/45.53;19.13)
 */
async function fetchBogojevoAirPressure(): Promise<number> {
  try {
    const res = await fetch(VENTUSKY_BOGOJEVO_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'hr-HR,hr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cookie': 'units=m; p=hpa;'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const html = await res.text();
      // Izvuci točnu vrijednost tlaka iz tablice Ventusky
      const tableMatch = html.match(/(?:Tlak zraka|Air pressure|Pressure)[^<]*<\/td>\s*<td[^>]*>\s*<b>\s*(\d{3,4})\s*(?:&nbsp;|\s)*hPa/i)
        || html.match(/<b>\s*(\d{3,4})\s*(?:&nbsp;|\s)*hPa\s*<\/b>/i)
        || html.match(/(\d{3,4})\s*(?:&nbsp;|\s)*hPa/i);
      if (tableMatch && tableMatch[1]) {
        const val = parseInt(tableMatch[1], 10);
        if (val >= 940 && val <= 1065) return val;
      }
      // Provjera ako je u inHg jedinicama
      const inHgMatch = html.match(/(?:Tlak zraka|Air pressure)[^<]*<\/td>\s*<td[^>]*>\s*<b>\s*(\d+(?:\.\d+)?)\s*(?:&nbsp;|\s)*inHg/i);
      if (inHgMatch && inHgMatch[1]) {
        const inhg = parseFloat(inHgMatch[1]);
        if (!isNaN(inhg)) return Math.round(inhg * 33.8639);
      }
    }
  } catch (err) {
    console.warn('Greška pri dohvatu tlaka zraka s Ventusky (Bogojevo):', err);
  }

  // Točan live MSL barometar za koordinate Bogojeva kao automatski fallback
  try {
    const mRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=45.53&longitude=19.13&current=surface_pressure,pressure_msl&timezone=Europe%2FZagreb', {
      signal: AbortSignal.timeout(4000)
    });
    if (mRes.ok) {
      const mData = await mRes.json();
      const p = mData.current?.pressure_msl || mData.current?.surface_pressure;
      if (p) return Math.round(p);
    }
  } catch {}
  return 1022;
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
      time: '08:00',
      level: -35,
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
    const airTemp = await fetchAljmasAirTemp();

    const aljmasPayload = {
      success: true,
      stationName: 'Dunav - Aljmaš (Ušće Drave)',
      riverKm: 'rkm 1380,300',
      waterLevelCm: latest.level,
      waterLevelTrend: trend,
      waterLevelChangeCm: latest.trendChange,
      timeOfMeasurement: latest.time,
      dateOfMeasurement: latest.date,
      airTempC: airTemp,
      waterTempC: waterTemp,
      airPressureHpa,
      maxLevelCm: maxMatch ? parseInt(maxMatch[1], 10) : 820,
      maxLevelDate: maxMatch && maxMatch[2] ? maxMatch[2].trim() : '25.06.1965.',
      prepLevelCm: prepMatch ? parseInt(prepMatch[1], 10) : 400,
      recentHours: rows.slice(0, 10),
      sourceUrl: MVODOSTAJI_ALJMAS_URL,
      waterTempSourceUrl: SEATEMP_ALJMAS_VUKOVAR_URL,
      airPressureSourceUrl: VENTUSKY_ALJMAS_URL,
      airTempSourceUrl: YR_ALJMAS_URL,
      isLive: true,
      updatedAt: Date.now()
    };

    if (serverDb) {
      setDoc(doc(serverDb, 'water_stations', 'aljmas'), aljmasPayload, { merge: true }).catch(() => {});
    }

    res.json(aljmasPayload);
  } catch (error) {
    console.warn('Greška pri dohvatu Aljmaš vodostaja s mvodostaji.voda.hr, fallback na snapshot:', error);
    res.json({
      success: false,
      stationName: 'Dunav - Aljmaš (Ušće Drave)',
      riverKm: 'rkm 1380,300',
      waterLevelCm: -70,
      waterLevelTrend: 'opada',
      waterLevelChangeCm: -1,
      waterTempC: 9.8,
      airPressureHpa: 1025,
      timeOfMeasurement: '08:00',
      dateOfMeasurement: '30.10.2026.',
      maxLevelCm: 820,
      prepLevelCm: 400,
      sourceUrl: MVODOSTAJI_ALJMAS_URL,
      waterTempSourceUrl: SEATEMP_ALJMAS_VUKOVAR_URL,
      airPressureSourceUrl: VENTUSKY_ALJMAS_URL,
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

    const parsedLevel = levelMatch ? parseInt(levelMatch[1], 10) : -44;
    const parsedChange = changeMatch ? parseInt(changeMatch[1], 10) : 10;
    const parsedFlow = flowMatch ? parseInt(flowMatch[1], 10) : 1200;

    // Temperatura vode za Bogojevo s https://www.hidmet.gov.rs/latin/hidrologija/izvestajne/prognoza.php?hm_id=42015
    const waterTemp = await fetchBogojevoWaterTemp();
    const airPressureHpa = await fetchBogojevoAirPressure();
    const airTemp = await fetchBogojevoAirTemp();

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

    const bogojevoPayload = {
      success: true,
      stationName: 'RHMZ Dunav - Bogojevo',
      waterBody: 'Dunav',
      waterLevelCm: parsedLevel,
      waterLevelChangeCm: parsedChange,
      waterLevelTrend: parsedTrend,
      airTempC: airTemp,
      waterTempC: waterTemp,
      airPressureHpa,
      flowM3s: parsedFlow,
      forecastDays: forecastDays.length > 0 ? forecastDays : [-92, -86, -90, -96],
      regularDefenseCm: 600,
      emergencyDefenseCm: 700,
      sourceUrl: HIDMET_BOGOJEVO_URL,
      waterTempSourceUrl: HIDMET_BOGOJEVO_TEMP_URL,
      airPressureSourceUrl: VENTUSKY_BOGOJEVO_URL,
      airTempSourceUrl: YR_BOGOJEVO_URL,
      isLive: true,
      updatedAt: Date.now()
    };

    if (serverDb) {
      setDoc(doc(serverDb, 'water_stations', 'bogojevo'), bogojevoPayload, { merge: true }).catch(() => {});
    }

    res.json(bogojevoPayload);
  } catch (error) {
    console.warn('Greška pri dohvatu Bogojevo vodostaja s hidmet.gov.rs, fallback na snapshot:', error);
    res.json({
      success: false,
      stationName: 'RHMZ Dunav - Bogojevo',
      waterBody: 'Dunav',
      waterLevelCm: -77,
      waterLevelChangeCm: -2,
      waterLevelTrend: 'opada',
      waterTempC: 8.1,
      airPressureHpa: 1025,
      flowM3s: 1180,
      forecastDays: [-92, -86, -90, -96],
      regularDefenseCm: 600,
      emergencyDefenseCm: 700,
      sourceUrl: HIDMET_BOGOJEVO_URL,
      waterTempSourceUrl: HIDMET_BOGOJEVO_TEMP_URL,
      airPressureSourceUrl: VENTUSKY_BOGOJEVO_URL,
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
  nameSetByAdmin?: boolean; // true = ime je trajno postavio administrator i zaštićeno je od prebrisavanja
  createdAt: string;
  lastSeenAt: string;
  notes?: string;
}

export interface ChatReadReceipt {
  deviceId: string;
  userName: string;
  readAt: number;
}

export interface ChatMessageRecord {
  id: string;
  deviceId: string;
  userName: string;
  text: string;
  timestamp: string;
  createdAt: number;
  readBy?: ChatReadReceipt[];
  replyTo?: {
    id: string;
    userName: string;
    text: string;
  };
  reactions?: {
    emoji: string;
    deviceId: string;
    userName: string;
    createdAt?: number;
  }[];
}

const DATA_DIR = path.resolve(__dirname, 'data');
const LICENSES_FILE = path.join(DATA_DIR, 'licenses.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat.json');
const CATCHES_FILE = path.join(DATA_DIR, 'catches.json');

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

function loadCatches(): any {
  try {
    ensureDataStorage();
    if (fs.existsSync(CATCHES_FILE)) {
      const raw = fs.readFileSync(CATCHES_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Greška pri učitavanju ulova:', err);
  }
  return null;
}

function saveCatches(data: any): void {
  try {
    ensureDataStorage();
    fs.writeFileSync(CATCHES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Greška pri spremanju ulova:', err);
  }
}

interface PollWaiter {
  deviceId: string;
  lastSeenId: string;
  resolve: (data: any) => void;
}

const chatPollWaiters: PollWaiter[] = [];

function notifyPollWaiters(newMsg: ChatMessageRecord) {
  if (!newMsg || !newMsg.id) return;
  if (chatPollWaiters.length === 0) return;
  const waiters = chatPollWaiters.splice(0, chatPollWaiters.length);
  for (const w of waiters) {
    if (w.deviceId !== newMsg.deviceId && w.lastSeenId !== newMsg.id) {
      w.resolve({
        hasNew: true,
        count: 1,
        message: {
          id: newMsg.id,
          deviceId: newMsg.deviceId,
          userName: newMsg.userName || 'Ribič',
          text: newMsg.text || '',
          timestamp: newMsg.timestamp || '',
          createdAt: newMsg.createdAt || Date.now()
        }
      });
    } else {
      w.resolve({ hasNew: false });
    }
  }
}

// Inicijalizacija Firebase Firestore sinkronizacije na poslužitelju
let serverDb: any = null;
try {
  const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const rawCfg = fs.readFileSync(firebaseConfigPath, 'utf-8');
    const firebaseConfig = JSON.parse(rawCfg);
    const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    serverDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId || '(default)');
    console.log('Poslužitelj povezan s Firestore:', firebaseConfig.firestoreDatabaseId);

    // 1. Učitaj trajne licence iz Firestore oblaka (Firestore je MASTER izvor istine koji preživljava nadogradnje!)
    getDocs(collection(serverDb, 'licenses')).then(snap => {
      if (!snap.empty) {
        const firestoreLicenses: LicenseRecord[] = [];
        snap.forEach(d => {
          const data = d.data() as LicenseRecord;
          if (data.deviceId) firestoreLicenses.push(data);
        });
        const local = loadLicenses();
        const mergedMap = new Map<string, LicenseRecord>();
        local.forEach(l => { if (l.deviceId) mergedMap.set(l.deviceId, l); });
        firestoreLicenses.forEach(fsLic => {
          const loc = mergedMap.get(fsLic.deviceId);
          if (!loc) {
            mergedMap.set(fsLic.deviceId, fsLic);
          } else {
            // Firestore ima apsolutnu prednost ako ima prilagođeno ime postavljeno od admina
            const fsHasCustom = fsLic.userName && (!fsLic.userName.startsWith('Ribič (') || fsLic.nameSetByAdmin);
            mergedMap.set(fsLic.deviceId, {
              ...loc,
              ...fsLic,
              userName: fsHasCustom ? fsLic.userName : (loc.userName || fsLic.userName)
            });
          }
        });
        saveLicenses(Array.from(mergedMap.values()));
        console.log(`[Poslužitelj] Uspješno sinkronizirano ${firestoreLicenses.length} trajnih licenci iz Firestorea.`);
      }
    }).catch(err => {
      console.warn('Upozorenje: dohvat licenci iz Firestorea na pokretanju:', err);
    });

    // 2. Sinkroniziraj podatke o najnovijoj verziji za Ažuriranja
    setDoc(doc(serverDb, 'app_updates', 'latest'), {
      version: '1.7.4',
      name: 'RiboPrognoza',
      releaseDate: '2026-11-10',
      apkUrl: 'https://github.com/dxdandy/Android-App-Repo/releases/latest/download/RiboPrognoza_v1.7.4.apk',
      changelog: [
        'Optimizacija baterije (Battery Saver): uklonjeno učestalo buđenje procesora (Frequent wakeups) dok je zaslon mobitela ugašen',
        'Pametni pozadinski rad: automatsko pauziranje nepotrebnih mrežnih provjera dok je mobitel zaključan uz zadržavanje obavijesti o porukama',
        'LiveChat lajkanje poruka (6 osnovnih emojija + prošireni (+) izbornik) i dvostruka sinkronizacija poruka'
      ],
      isCritical: false,
      updateType: 'live_web',
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(() => {});

    // 3b. Objavi kompilirani JS i CSS bundle u Firestore ota_bundle za stvarno OTA ažuriranje na mobitelu
    const publishOtaBundleToFirestore = async () => {
      try {
        const jsPath = path.resolve(__dirname, 'dist', 'assets', 'app-bundle.js');
        const cssPath = path.resolve(__dirname, 'dist', 'assets', 'app-bundle.css');
        if (!fs.existsSync(jsPath)) return;
        const jsContent = fs.readFileSync(jsPath, 'utf-8');
        const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf-8') : '';
        const CHUNK_SIZE = 400000; // 400 KB po Firestore dokumentu (limit je 1 MB)
        const totalChunks = Math.ceil(jsContent.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
          const slice = jsContent.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await setDoc(doc(serverDb, 'ota_bundle', `chunk_${i}`), {
            version: '1.7.4',
            index: i,
            data: slice,
            updatedAt: Date.now()
          });
        }
        await setDoc(doc(serverDb, 'ota_bundle', 'manifest'), {
          version: '1.7.4',
          totalChunks,
          chunkCount: totalChunks,
          css: cssContent,
          updatedAt: Date.now()
        });
        console.log(`[OTA] Objavljen kompilirani kod v1.7.4 u Firestore ota_bundle (${totalChunks} dijelova).`);
      } catch (err) {
        console.warn('Upozorenje pri objavi OTA bundlea u Firestore:', err);
      }
    };
    publishOtaBundleToFirestore();

    // 4. Sinkroniziraj zadnjih 45 poruka iz Firestore u lokalnu bazu poslužitelja u stvarnom vremenu
    const chatQuery = query(collection(serverDb, 'chat_messages'), orderBy('createdAt', 'asc'), limitToLast(45));
    onSnapshot(chatQuery, snapshot => {
      let currentChat = loadChat();
      let hasChanges = false;
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          const d = change.doc.data();
          const docId = change.doc.id;
          if (docId === '_room_state_') return;
          const idx = currentChat.findIndex(m => m.id === docId);
          const newEntry: ChatMessageRecord = {
            id: docId,
            deviceId: d.deviceId || '',
            userName: d.userName || 'Ribič',
            text: d.text || '',
            timestamp: d.timestamp || '',
            createdAt: d.createdAt || Date.now(),
            readBy: d.readBy || [],
            replyTo: d.replyTo || undefined,
            reactions: d.reactions || []
          };
          if (idx >= 0) {
            currentChat[idx] = newEntry;
            hasChanges = true;
          } else {
            currentChat.push(newEntry);
            hasChanges = true;
            notifyPollWaiters(newEntry);
          }
        } else if (change.type === 'removed') {
          const docId = change.doc.id;
          currentChat = currentChat.filter(m => m.id !== docId);
          hasChanges = true;
        }
      });
      if (hasChanges) {
        currentChat.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        saveChat(currentChat);
      }
    }, err => {
      console.warn('Upozorenje: Firestore chat listener na poslužitelju:', err);
    });

    // 4. Sinkroniziraj sve licence iz Firestore u lokalnu bazu poslužitelja u stvarnom vremenu
    onSnapshot(collection(serverDb, 'licenses'), snapshot => {
      let currentLicenses = loadLicenses();
      let hasChanges = false;
      snapshot.docChanges().forEach(change => {
        const d = change.doc.data() as LicenseRecord;
        const docId = change.doc.id;
        if (change.type === 'added' || change.type === 'modified') {
          const idx = currentLicenses.findIndex(l => l.deviceId === docId);
          if (idx >= 0) {
            currentLicenses[idx] = { ...currentLicenses[idx], ...d };
            hasChanges = true;
          } else {
            currentLicenses.push(d);
            hasChanges = true;
          }
        } else if (change.type === 'removed') {
          currentLicenses = currentLicenses.filter(l => l.deviceId !== docId);
          hasChanges = true;
        }
      });
      if (hasChanges) {
        saveLicenses(currentLicenses);
      }
    }, err => {
      console.warn('Upozorenje: Firestore licenses listener na poslužitelju:', err);
    });
  }
} catch (err) {
  console.warn('Upozorenje pri inicijalizaciji Firebase na poslužitelju:', err);
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
    // Trajna zaštita imena: Ako je admin postavio ime ili ako ime nije generičko "Ribič (...)",
    // nikada ga ne prepisujemo s privremenim imenom s mobitela!
    const isGeneric = !existing.userName || existing.userName.startsWith('Ribič (');
    if (!existing.nameSetByAdmin && isGeneric && proposedName) {
      const cleanProp = String(proposedName).trim();
      if (cleanProp && !cleanProp.startsWith('Ribič (')) {
        existing.userName = cleanProp;
      }
    }
    saveLicenses(licenses);
    if (serverDb) {
      setDoc(doc(serverDb, 'licenses', cleanDeviceId), {
        lastSeenAt: existing.lastSeenAt,
        status: existing.status,
        chatEnabled: existing.chatEnabled,
        userName: existing.userName,
        nameSetByAdmin: !!existing.nameSetByAdmin
      }, { merge: true }).catch(() => {});
    }

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
    nameSetByAdmin: false,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };

  licenses.push(newRec);
  saveLicenses(licenses);
  if (serverDb) {
    setDoc(doc(serverDb, 'licenses', cleanDeviceId), newRec, { merge: true }).catch(() => {});
  }

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
    licenses[existingIdx].nameSetByAdmin = true;
    if (typeof notes === 'string') licenses[existingIdx].notes = notes.trim();
    licenses[existingIdx].lastSeenAt = new Date().toISOString();
    saveLicenses(licenses);
    if (serverDb) {
      setDoc(doc(serverDb, 'licenses', cleanDeviceId), licenses[existingIdx], { merge: true }).catch(() => {});
    }
    return res.json({ success: true, license: licenses[existingIdx], updated: true });
  }

  const newRecord: LicenseRecord = {
    deviceId: cleanDeviceId,
    activationKey: validKey,
    userName: cleanName,
    status: cleanStatus,
    chatEnabled: cleanChat,
    nameSetByAdmin: true,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    notes: (notes && String(notes).trim()) || ''
  };

  licenses.unshift(newRecord);
  saveLicenses(licenses);
  if (serverDb) {
    setDoc(doc(serverDb, 'licenses', cleanDeviceId), newRecord, { merge: true }).catch(() => {});
  }
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
    if (serverDb) {
      setDoc(doc(serverDb, 'licenses', cleanDeviceId), newRecord, { merge: true }).catch(() => {});
    }
    return res.json({ success: true, license: newRecord });
  }

  if (typeof userName === 'string') {
    target.userName = userName.trim();
    target.nameSetByAdmin = true;
  }
  if (status === 'active' || status === 'revoked') target.status = status;
  if (typeof chatEnabled === 'boolean') target.chatEnabled = chatEnabled;
  if (typeof notes === 'string') target.notes = notes.trim();

  saveLicenses(licenses);
  if (serverDb) {
    setDoc(doc(serverDb, 'licenses', cleanDeviceId), target, { merge: true }).catch(() => {});
  }
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
  if (serverDb) {
    deleteDoc(doc(serverDb, 'licenses', cleanDeviceId)).catch(() => {});
  }

  res.json({ success: true, message: 'Licenca obrisana' });
});

/**
 * API: Dohvat poruka internog chata (samo odobreni korisnici kojima nije blokiran chat)
 */
app.get('/api/chat/messages', (req, res) => {
  const pin = req.headers['x-admin-pin'] as string;
  const deviceId = (req.query.deviceId as string) || (req.headers['x-device-id'] as string);
  const cleanDeviceId = deviceId ? String(deviceId).trim().toUpperCase() : '';

  // Admin ili korisnik - dohvaćamo bazu licenci i poruke
  const licenses = loadLicenses();
  const rawMessages = loadChat();

  // Mapa trenutnih imena iz baze kontrolnog panela po ID-u uređaja
  const nameMap = new Map<string, string>();
  licenses.forEach(l => {
    if (l.deviceId && l.userName) {
      nameMap.set(l.deviceId, l.userName);
    }
  });

  // Funkcija za obogaćivanje poruke trenutnim imenima iz baze, popisom tko ju je pročitao i reakcijama
  const enrichMsg = (msg: ChatMessageRecord) => {
    const currentName = nameMap.get(msg.deviceId) || msg.userName;
    const enrichedReadBy = (msg.readBy || []).map(r => ({
      ...r,
      userName: nameMap.get(r.deviceId) || r.userName
    }));
    const enrichedReactions = (msg.reactions || []).map(rx => ({
      ...rx,
      userName: nameMap.get(rx.deviceId) || rx.userName
    }));
    return {
      ...msg,
      userName: currentName,
      readBy: enrichedReadBy,
      reactions: enrichedReactions
    };
  };

  // Admin uvijek ima pravo pregleda
  if (pin === ADMIN_MASTER_PIN || cleanDeviceId === 'RP-ADMIN') {
    const enrichedMessages = rawMessages.slice(-70).map(enrichMsg);
    return res.json({ success: true, messages: enrichedMessages });
  }

  if (!cleanDeviceId) {
    return res.status(403).json({ 
      success: false, 
      chatBlocked: true, 
      message: 'Potrebna je aktivacija aplikacije za pristup LiveChatu.' 
    });
  }

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

  // Neka svi u chat grupi vide drugog korisnika i popis tko je sve pročitao poruku
  const enrichedMessages = rawMessages.slice(-70).map(enrichMsg);

  return res.json({ success: true, messages: enrichedMessages });
});

/**
 * API: Pozadinski poll endpoint za native Android i pozadinske obavijesti
 * Vraća najnoviju poruku ako postoji nova poruka koju nije poslao ovaj uređaj.
 * Podržava long-polling (wait=true) do 15 sekundi za trenutnu reakciju bez trošenja baterije.
 */
app.get('/api/chat/poll', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const deviceId = (req.query.deviceId as string) || '';
  const lastSeenId = (req.query.lastSeenId as string) || '';
  const shouldWait = req.query.wait === 'true';

  const cleanDeviceId = deviceId ? String(deviceId).trim().toUpperCase() : '';
  const rawMessages = loadChat();

  // Pronađi najnoviju poruku
  const latestMsg = rawMessages.length > 0 ? rawMessages[rawMessages.length - 1] : null;

  if (latestMsg && latestMsg.id !== lastSeenId && (!cleanDeviceId || latestMsg.deviceId !== cleanDeviceId)) {
    // Postoji nova poruka od nekog drugog!
    return res.json({
      hasNew: true,
      count: 1,
      message: {
        id: latestMsg.id,
        deviceId: latestMsg.deviceId,
        userName: latestMsg.userName || 'Ribič',
        text: latestMsg.text || '',
        timestamp: latestMsg.timestamp || '',
        createdAt: latestMsg.createdAt || Date.now()
      }
    });
  }

  if (!shouldWait) {
    return res.json({ hasNew: false });
  }

  // Long-poll čekanje do 15 sekundi za novu poruku
  let resolved = false;
  const timer = setTimeout(() => {
    if (resolved) return;
    resolved = true;
    const idx = chatPollWaiters.findIndex(w => w.resolve === finish);
    if (idx !== -1) chatPollWaiters.splice(idx, 1);
    res.json({ hasNew: false, timeout: true });
  }, 15000);

  const finish = (payload: any) => {
    if (resolved) return;
    resolved = true;
    clearTimeout(timer);
    res.json(payload);
  };

  chatPollWaiters.push({
    deviceId: cleanDeviceId,
    lastSeenId,
    resolve: finish
  });
});

/**
 * API: Zabilježi potvrdu čitanja poruka (svima dostupno)
 */
app.post('/api/chat/read', (req, res) => {
  const { deviceId, userName, messageIds } = req.body || {};
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId je obavezan' });
  }

  const cleanDeviceId = String(deviceId).trim().toUpperCase();
  const licenses = loadLicenses();
  const userLicense = licenses.find(l => l.deviceId === cleanDeviceId);
  const readerName = (userLicense && userLicense.userName) || (userName && String(userName).trim()) || `Ribič (${cleanDeviceId.slice(-4)})`;

  let chat = loadChat();
  let updated = false;
  const now = Date.now();
  const targetIds = Array.isArray(messageIds) && messageIds.length > 0 ? new Set(messageIds) : null;

  chat = chat.map(msg => {
    // Ne označavaj vlastitu poruku kao da si je pročitao
    if (msg.deviceId === cleanDeviceId) return msg;

    if (!targetIds || targetIds.has(msg.id)) {
      const readList = msg.readBy || [];
      const alreadyRead = readList.some(r => r.deviceId === cleanDeviceId);
      if (!alreadyRead) {
        updated = true;
        return {
          ...msg,
          readBy: [...readList, { deviceId: cleanDeviceId, userName: readerName, readAt: now }]
        };
      }
    }
    return msg;
  });

  if (updated) {
    saveChat(chat);
  }

  return res.json({ success: true, updated });
});

/**
 * API: Promjena vlastitog imena korisnika u chatu
 */
app.post('/api/chat/rename', (req, res) => {
  const { deviceId, newName } = req.body || {};
  if (!deviceId || !newName || !String(newName).trim()) {
    return res.status(400).json({ error: 'ID uređaja i novo ime su obavezni' });
  }

  const cleanDeviceId = String(deviceId).trim().toUpperCase();
  const cleanName = String(newName).trim().slice(0, 30);

  const licenses = loadLicenses();
  const existing = licenses.find(l => l.deviceId === cleanDeviceId);
  if (existing) {
    existing.userName = cleanName;
    existing.nameSetByAdmin = true;
    saveLicenses(licenses);
    if (serverDb) {
      setDoc(doc(serverDb, 'licenses', cleanDeviceId), { userName: cleanName, nameSetByAdmin: true }, { merge: true }).catch(() => {});
    }
  } else {
    const newRecord: LicenseRecord = {
      deviceId: cleanDeviceId,
      activationKey: generateActivationKey(cleanDeviceId),
      userName: cleanName,
      status: 'active',
      chatEnabled: true,
      nameSetByAdmin: true,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };
    licenses.push(newRecord);
    saveLicenses(licenses);
    if (serverDb) {
      setDoc(doc(serverDb, 'licenses', cleanDeviceId), newRecord, { merge: true }).catch(() => {});
    }
  }

  // Ažuriraj i u zadnjim spremljenim porukama
  let chat = loadChat();
  let updatedAny = false;
  chat = chat.map(m => {
    if (m.deviceId === cleanDeviceId) {
      updatedAny = true;
      if (serverDb) {
        setDoc(doc(serverDb, 'chat_messages', m.id), { userName: cleanName }, { merge: true }).catch(() => {});
      }
      return { ...m, userName: cleanName };
    }
    return m;
  });
  if (updatedAny) {
    saveChat(chat);
  }

  return res.json({ success: true, userName: cleanName });
});

/**
 * API: Slanje poruke u interni chat (dozvoljeno isključivo aktivnim korisnicima s odobrenim chatom)
 */
app.post('/api/chat/messages', (req, res) => {
  const { deviceId, text, activationKey, userName: proposedName, replyTo } = req.body || {};
  if (!deviceId || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'Tekst poruke je obavezan' });
  }

  const cleanDeviceId = String(deviceId).trim().toUpperCase();
  const licenses = loadLicenses();
  let userLicense = licenses.find(l => l.deviceId === cleanDeviceId);

  // Ako korisnik još nije u bazi na poslužitelju, provjeri aktivacijski ključ
  if (!userLicense) {
    const cleanKey = activationKey ? String(activationKey).trim().toUpperCase() : '';
    if (cleanDeviceId === 'RP-ADMIN' || (cleanKey && verifyActivationKey(cleanDeviceId, cleanKey))) {
      userLicense = {
        deviceId: cleanDeviceId,
        activationKey: cleanKey || generateActivationKey(cleanDeviceId),
        userName: cleanDeviceId === 'RP-ADMIN' ? 'Administrator' : (proposedName && String(proposedName).trim()) || `Ribič (${cleanDeviceId.slice(-4)})`,
        status: 'active',
        chatEnabled: true,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      };
      licenses.push(userLicense);
      saveLicenses(licenses);
    } else {
      return res.status(403).json({ error: 'Potrebna je aktivacija aplikacije za slanje poruka u chat.' });
    }
  }

  if (userLicense.status === 'revoked') {
    return res.status(403).json({ error: 'Vaša licenca je ukinuta od strane administratora.' });
  }

  if (userLicense.chatEnabled === false) {
    return res.status(403).json({ error: 'Administrator vam je onemogućio pristup LiveChatu.' });
  }

  userLicense.lastSeenAt = new Date().toISOString();
  saveLicenses(licenses);

  const cleanText = String(text).trim().slice(0, 350); // limit 350 znakova

  let chat = loadChat();
  const msgId = (req.body.id && String(req.body.id).trim()) || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const msgCreatedAt = (req.body.createdAt && Number(req.body.createdAt)) || Date.now();
  const newMsg: ChatMessageRecord = {
    id: msgId,
    deviceId: cleanDeviceId,
    userName: userLicense.userName, // Koristi službeno ime iz kontrolnog panela
    text: cleanText,
    timestamp: new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }),
    createdAt: msgCreatedAt,
    readBy: [{ deviceId: cleanDeviceId, userName: userLicense.userName, readAt: Date.now() }]
  };

  if (replyTo && replyTo.text) {
    newMsg.replyTo = {
      id: String(replyTo.id),
      userName: String(replyTo.userName || 'Ribič'),
      text: String(replyTo.text).slice(0, 200)
    };
  }

  const existingIdx = chat.findIndex(m => m.id === newMsg.id);
  if (existingIdx >= 0) {
    chat[existingIdx] = newMsg;
  } else {
    chat.push(newMsg);
    notifyPollWaiters(newMsg);
  }
  if (chat.length > 250) {
    chat = chat.slice(-250);
  }
  saveChat(chat);

  // Sinkroniziraj i u Firestore oblak tako da svi mobilni i web klijenti prime poruku u istoj sekundi
  if (serverDb) {
    const firestorePayload: Record<string, any> = {
      id: newMsg.id,
      deviceId: newMsg.deviceId,
      userName: newMsg.userName,
      text: newMsg.text,
      timestamp: newMsg.timestamp,
      createdAt: newMsg.createdAt,
      readBy: newMsg.readBy
    };
    if (newMsg.replyTo) {
      firestorePayload.replyTo = newMsg.replyTo;
    }
    setDoc(doc(serverDb, 'chat_messages', newMsg.id), firestorePayload, { merge: true }).catch(err => {
      console.warn('Greška pri sinkronizaciji u Firestore iz /api/chat/messages:', err);
    });
  }

  return res.json({ success: true, message: newMsg });
});

/**
 * API: Lajkanje / dodavanje ili uklanjanje emoji reakcije na poruku u LiveChatu
 */
app.post('/api/chat/react', (req, res) => {
  const { messageId, emoji, deviceId, userName, reactions } = req.body || {};
  if (!messageId || !deviceId) {
    return res.status(400).json({ error: 'Nedostaje messageId ili deviceId' });
  }

  const cleanDeviceId = String(deviceId).trim().toUpperCase();
  const licenses = loadLicenses();
  const userLicense = licenses.find(l => l.deviceId === cleanDeviceId);
  const reactorName = (userLicense && userLicense.userName) || (userName && String(userName).trim()) || `Ribič (${cleanDeviceId.slice(-4)})`;

  let chat = loadChat();
  const idx = chat.findIndex(m => m.id === messageId);
  if (idx >= 0) {
    let updatedReactions = Array.isArray(reactions) ? reactions : (chat[idx].reactions || []);
    if (!Array.isArray(reactions) && emoji) {
      const existingList = Array.isArray(chat[idx].reactions) ? [...chat[idx].reactions!] : [];
      const rIdx = existingList.findIndex(r => r.deviceId === cleanDeviceId);
      if (rIdx >= 0 && existingList[rIdx].emoji === emoji) {
        updatedReactions = existingList.filter((_, i) => i !== rIdx);
      } else if (rIdx >= 0) {
        existingList[rIdx] = { emoji, deviceId: cleanDeviceId, userName: reactorName, createdAt: Date.now() };
        updatedReactions = existingList;
      } else {
        updatedReactions = [...existingList, { emoji, deviceId: cleanDeviceId, userName: reactorName, createdAt: Date.now() }];
      }
    }

    chat[idx].reactions = updatedReactions;
    saveChat(chat);

    if (serverDb) {
      setDoc(doc(serverDb, 'chat_messages', messageId), { reactions: updatedReactions }, { merge: true }).catch(() => {});
    }
    return res.json({ success: true, reactions: updatedReactions });
  }

  return res.json({ success: true });
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

  if (serverDb) {
    deleteDoc(doc(serverDb, 'chat_messages', id)).catch(() => {});
  }

  res.json({ success: true });
});

/**
 * API (Admin): Brisanje cijele povijesti chata za sve korisnike (Clear History)
 */
app.post('/api/admin/chat/clear', async (req, res) => {
  const pin = (req.headers['x-admin-pin'] as string) || req.body?.pin;
  if (pin !== ADMIN_MASTER_PIN) {
    return res.status(403).json({ error: 'Neispravan administratorski PIN' });
  }

  saveChat([]);

  if (serverDb) {
    try {
      const snap = await getDocs(collection(serverDb, 'chat_messages'));
      for (const d of snap.docs) {
        await deleteDoc(doc(serverDb, 'chat_messages', d.id));
      }
    } catch (err) {
      console.warn('Greška pri brisanju poruka u Firestoreu na poslužitelju:', err);
    }
  }

  res.json({ success: true, message: 'Cijela povijest chata je uspješno obrisana za sve korisnike.' });
});

/**
 * API: Dohvat i ažuriranje zajedničke evidencije ulova po vrstama ribe
 */
app.get('/api/catches', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const data = loadCatches();
  res.json(data || { counts: {}, anglerDevices: {}, history: [], updatedAt: 0 });
});

app.post('/api/catches/update', (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Neispravan format podataka.' });
  }
  saveCatches(incoming);
  if (serverDb) {
    setDoc(doc(serverDb, 'catch_stats', 'dunav_ulovi'), incoming, { merge: true }).catch(() => {});
  }
  res.json({ success: true });
});

/**
 * API: Provjera najnovije verzije aplikacije
 */
app.get('/api/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    version: '1.7.4',
    name: 'RiboPrognoza',
    releaseDate: '2026-11-10',
    apkUrl: 'https://github.com/dxdandy/Android-App-Repo/releases/latest/download/RiboPrognoza_v1.7.4.apk',
    changelog: [
      'Optimizacija baterije (Battery Saver): uklonjeno učestalo buđenje procesora (Frequent wakeups) dok je zaslon mobitela ugašen',
      'Pametni pozadinski rad: automatsko pauziranje nepotrebnih mrežnih provjera dok je mobitel zaključan uz zadržavanje obavijesti o porukama',
      'LiveChat lajkanje poruka (6 osnovnih emojija + prošireni (+) izbornik) i dvostruka sinkronizacija poruka'
    ],
    isCritical: false,
    updateType: 'live_web'
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
    // Automatski osvježi mjerne postaje Aljmaš i Bogojevo odmah po pokretanju i svakih 5 minuta kako bi Firestore imao identične podatke za mobitel
    const syncStations = () => {
      fetch(`http://127.0.0.1:${PORT}/api/water/aljmas`).catch(() => {});
      fetch(`http://127.0.0.1:${PORT}/api/water/bogojevo`).catch(() => {});
    };
    setTimeout(syncStations, 1500);
    setInterval(syncStations, 5 * 60 * 1000);
  });
}

startServer();
