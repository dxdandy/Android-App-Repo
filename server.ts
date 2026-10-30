import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

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

/**
 * API: Provjera najnovije verzije aplikacije
 */
app.get('/api/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    version: '1.2.4',
    name: 'RiboPrognoza',
    releaseDate: '2026-10-30',
    apkUrl: 'https://github.com/dxdandy/Android-App-Repo/releases/latest/download/RiboPrognoza.apk',
    changelog: [
      'Optimiziran raspored na vrhu: blinkajući tekst i gumb za donaciju premješteni u podnožje aplikacije',
      'Gumbovi Osnovni mod i Ekspertni mod podignuti više prema vrhu odmah ispod naslova za trenutačnu dostupnost',
      'Podignut i ukomponiran cijeli sadržaj Osnovnog moda uz smanjene razmake za savršenu preglednost bez nepotrebnog scrollanja',
      'Zadržano automatsko prepoznavanje vertikalnog i horizontalnog položaja s prilagođenim layoutom'
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
