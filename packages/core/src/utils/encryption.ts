/**
 * Utility per la crittografia dei token OAuth
 * Nota: libsodium-wrappers è una libreria Node.js e potrebbe non funzionare nel browser.
 * In Tauri, questa logica potrebbe essere implementata usando le API native di crittografia.
 */

let sodium: any | null = null;
let sodiumReady: Promise<any> | null = null;

/**
 * Inizializza libsodium
 */
const initSodium = async (): Promise<any> => {
  if (sodium) {
    return sodium;
  }

  if (sodiumReady) {
    return sodiumReady;
  }

  sodiumReady = (async () => {
    try {
      // Import dinamico per evitare errori se il modulo non è disponibile
      // @ts-ignore - import dinamico opzionale
      const _sodiumModule = await new Function('return import("libsodium-wrappers")')().catch(() => null);
      
      if (!_sodiumModule || !_sodiumModule.default) {
        throw new Error('libsodium-wrappers non disponibile');
      }

      const _sodium = _sodiumModule.default;
      await _sodium.ready;
      sodium = _sodium;
      return sodium;
    } catch (error) {
      console.warn('libsodium-wrappers non disponibile, usando fallback:', error);
      // Fallback: usa Web Crypto API se disponibile
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        // TODO: Implementare crittografia usando Web Crypto API
        throw new Error('Crittografia non disponibile. Implementare fallback con Web Crypto API o comando Tauri.');
      }
      throw new Error('Crittografia non disponibile');
    }
  })();

  return sodiumReady;
};

/**
 * Crittografa un valore
 */
export const encrypt = async (value: string): Promise<Buffer> => {
  const s = await initSodium();
  const k = s.crypto_generichash(32, 'mail-client-secret-key-v1');
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  const encrypted = s.crypto_secretbox_easy(value, nonce, k);
  return Buffer.from([...nonce, ...encrypted]);
};

/**
 * Decrittografa un valore
 */
export const decrypt = async (encrypted: Buffer): Promise<string> => {
  const s = await initSodium();
  const k = s.crypto_generichash(32, 'mail-client-secret-key-v1');
  const nonce = encrypted.slice(0, s.crypto_secretbox_NONCEBYTES);
  const ciphertext = encrypted.slice(s.crypto_secretbox_NONCEBYTES);
  return s.crypto_secretbox_open_easy(ciphertext, nonce, k, 'text');
};
