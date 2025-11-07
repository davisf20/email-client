/**
 * Utility per la crittografia dei token OAuth
 * Usa libsodium-wrappers se disponibile, altrimenti Web Crypto API come fallback
 */

let sodium: any | null = null;
let sodiumReady: Promise<any> | null = null;
let useWebCrypto = false;

/**
 * Inizializza libsodium o Web Crypto API
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
      // Tentativo di importare libsodium-wrappers
      // @ts-ignore - import dinamico opzionale
      const _sodiumModule = await new Function('return import("libsodium-wrappers")')().catch(() => null);
      
      if (_sodiumModule && _sodiumModule.default) {
        const _sodium = _sodiumModule.default;
        await _sodium.ready;
        sodium = _sodium;
        useWebCrypto = false;
        return sodium;
      }
      
      throw new Error('libsodium-wrappers non disponibile');
    } catch (error) {
      console.warn('libsodium-wrappers non disponibile, usando Web Crypto API come fallback:', error);
      
      // Fallback: usa Web Crypto API
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        useWebCrypto = true;
        sodium = { useWebCrypto: true }; // Marker per indicare che usiamo Web Crypto
        return sodium;
      }
      
      throw new Error('Crittografia non disponibile. Né libsodium né Web Crypto API sono disponibili.');
    }
  })();

  return sodiumReady;
};

/**
 * Deriva una chiave da una password usando Web Crypto API
 */
const deriveKey = async (password: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('mail-client-salt-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Helper per convertire Uint8Array in Buffer se disponibile, altrimenti restituisce Uint8Array
 */
const toBuffer = (data: Uint8Array): Buffer | Uint8Array => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data);
  }
  return data;
};

/**
 * Helper per convertire Buffer o Uint8Array in Uint8Array
 */
const toUint8Array = (data: Buffer | Uint8Array): Uint8Array => {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
    return new Uint8Array(data);
  }
  // Fallback: prova a creare Uint8Array da array-like
  return new Uint8Array(data as any);
};

/**
 * Crittografa un valore
 */
export const encrypt = async (value: string): Promise<Buffer | Uint8Array> => {
  const s = await initSodium();
  
  if (useWebCrypto && typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Usa Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const key = await deriveKey('mail-client-secret-key-v1');
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96 bit per AES-GCM
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // Combina IV + encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);
    
    return toBuffer(result);
  }
  
  // Usa libsodium
  const k = s.crypto_generichash(32, 'mail-client-secret-key-v1');
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  const encrypted = s.crypto_secretbox_easy(value, nonce, k);
  return Buffer.from([...nonce, ...encrypted]);
};

/**
 * Decrittografa un valore
 */
export const decrypt = async (encrypted: Buffer | Uint8Array): Promise<string> => {
  const s = await initSodium();
  
  if (useWebCrypto && typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Usa Web Crypto API
    const data = toUint8Array(encrypted);
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);
    const key = await deriveKey('mail-client-secret-key-v1');
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
  
  // Usa libsodium
  const data = toUint8Array(encrypted);
  const k = s.crypto_generichash(32, 'mail-client-secret-key-v1');
  const nonce = data.slice(0, s.crypto_secretbox_NONCEBYTES);
  const ciphertext = data.slice(s.crypto_secretbox_NONCEBYTES);
  return s.crypto_secretbox_open_easy(ciphertext, nonce, k, 'text');
};
