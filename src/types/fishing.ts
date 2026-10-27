export type WaterTrend = 'opada' | 'stagnira' | 'u_porastu' | 'nagli_porast';
export type PressureTrend = 'pad' | 'stabilan' | 'rast';
export type WeatherCondition = 
  | 'vedro' 
  | 'djelomicno_oblacno' 
  | 'oblacno' 
  | 'magla' 
  | 'slaba_kisa' 
  | 'pljusak' 
  | 'grmljavina' 
  | 'vjetrovito';

export type MoonPhase = 
  | 'mladjak' 
  | 'prva_cetvrt' 
  | 'pun_mjesec' 
  | 'zadnja_cetvrt' 
  | 'rastuci_srp' 
  | 'opadajuci_srp';

export interface SolunarPeriod {
  title?: string;
  badge?: string;
  start: string;
  end: string;
  peak?: string;
  description: string;
  isPeakOfDay?: boolean;
}

export interface HourlySolunarItem {
  hour: number;
  hourLabel: string;
  score: number; // 1-5
  status: 'vrhunac' | 'visoka' | 'srednja' | 'normalna';
}

export interface FishSpeciesAdvice {
  species: string;
  icon: string;
  recommendedDepth: string;
  recommendedBaits: string;
  advice: string;
}

export interface SolunarDayData {
  date: string;
  formattedDate: string;
  moonPhase: MoonPhase;
  moonPhaseName: string;
  illuminationPct: number;
  major1: SolunarPeriod;
  major2: SolunarPeriod;
  minor1: SolunarPeriod;
  minor2: SolunarPeriod;
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  goldenHourMorning: string;
  goldenHourEvening: string;
  overallScore: number; // 1 - 5
  activityPercentage: number; // 0 - 100%
  ratingText: string;
  summaryExplanation: string;
  hourlyActivity: HourlySolunarItem[];
  fishAdvices: FishSpeciesAdvice[];
}

export interface WaterLevelHistoryItem {
  date: string;
  time: string;
  level: number;
  trendChange?: number;
}

export interface StationWaterData {
  id: 'aljmas' | 'bogojevo';
  name: string;
  river: string;
  sectorName: string;
  riverKm: string;
  waterLevelCm: number;
  waterLevelTrend: WaterTrend;
  waterLevelChangeCm: number;
  flowM3s?: number;
  timeOfMeasurement: string;
  dateOfMeasurement: string;
  maxLevelCm?: number;
  maxLevelDate?: string;
  prepLevelCm?: number;
  regularDefenseCm?: number;
  emergencyDefenseCm?: number;
  recentHistory: WaterLevelHistoryItem[];
  forecastDays?: number[];
  airPressureHpa: number;
  airPressureTrend: PressureTrend;
  airTempC: number;
  waterTempC: number;
  windSpeedKmh: number;
  windDirection: string;
  weatherCondition: WeatherCondition;
  sourceUrl: string;
  sourceName: string;
  isLive: boolean;
  notes?: string;
}

export interface ExtractedMeteoData {
  waterLevelCm?: number;
  waterLevelTrend?: WaterTrend;
  waterTempC?: number;
  airTempC?: number;
  airTempMin?: number;
  airTempMax?: number;
  airPressureHpa?: number;
  airPressureTrend?: PressureTrend;
  windSpeedKmh?: number;
  windDirection?: string;
  weatherCondition?: WeatherCondition;
  sourceUrl: string;
  stationName?: string;
  extractedTextSnippet?: string;
  confidence: 'visoka' | 'srednja' | 'rucna';
}
