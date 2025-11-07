/**
 * Utility per i percorsi dell'applicazione
 */

/**
 * Ottiene la directory dati dell'applicazione
 * In Tauri, usa appDataDir() API
 */
export const appDataDir = async (): Promise<string> => {
  // In Tauri v2, usa l'API path
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    try {
      // Import dinamico usando una stringa che Vite non può risolvere staticamente
      // @ts-ignore - import dinamico opzionale
      const pathModule = await new Function('return import("@tauri-apps/api/path")')().catch(() => null);
      if (pathModule && pathModule.appDataDir) {
        return await pathModule.appDataDir();
      }
    } catch {
      // Fallback se l'API non è disponibile
    }
  }
  
  // Fallback per sviluppo/test
  // Usa una directory temporanea o locale per il browser
  if (typeof window !== 'undefined') {
    // In ambiente browser, usa localStorage o indexedDB per ottenere un percorso
    // Per ora usiamo una directory fissa
    return '/tmp/mail-client';
  }
  
  // Fallback per Node.js
  if (typeof process !== 'undefined') {
    if (process.platform === 'win32') {
      return `${process.env.APPDATA || ''}/mail-client`;
    }
    return `${process.env.HOME || ''}/.mail-client`;
  }
  
  return '/tmp/mail-client';
};

