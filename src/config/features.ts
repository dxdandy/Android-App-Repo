/**
 * Konfiguracija za privremenu izolaciju / suspenziju pojedinih funkcija.
 * Svaka funkcija ima svoj neovisni prekidač koji se može u bilo kojem trenutku
 * jednostavno vratiti u funkciju (postavljanjem na `true`) pojedinačno i neovisno.
 */
export const APP_FEATURES = {
  /**
   * 1. Interni LiveChat (chat prozor, slanje/uređivanje/brisanje poruka, zvučne obavijesti, listeneri)
   * Kada je `false`, LiveChat je potpuno suspendiran i nevidljiv za sve korisnike i administratore.
   */
  ENABLE_LIVE_CHAT: false,

  /**
   * 2. Gumb sunca (način rada s visokim kontrastom za jako vanjsko sunce)
   * Kada je `false`, gumb sunca u gornjem zaglavlju je uklonjen i način visokog kontrasta je suspendiran.
   */
  ENABLE_OUTDOOR_SUN_MODE: false,

  /**
   * 3. Pro mod (stručna analitika i usporedba postaja)
   * Kada je `false`, Pro mod je suspendiran i aplikacija radi isključivo u Osnovnom modu
   * uz Dnevni Solunar, Lovostaj i Evidenciju ulova.
   */
  ENABLE_PRO_MODE: false,
} as const;

export type AppFeaturesConfig = typeof APP_FEATURES;
