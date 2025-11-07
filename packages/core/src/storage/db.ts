/**
 * Inizializzazione database SQLite
 * Nota: better-sqlite3 è una libreria Node.js e non può essere eseguita nel browser.
 * In Tauri, questa logica dovrebbe usare IndexedDB o essere implementata come comando Rust.
 */

import * as schema from './schema';
import { appDataDir } from '../utils/paths';

let dbInstance: any | null = null;
let sqliteInstance: any | null = null;

/**
 * Ottiene l'istanza del database (singleton)
 * Nota: Questa funzione richiede better-sqlite3 che è disponibile solo in Node.js.
 * In Tauri, questa logica dovrebbe usare IndexedDB o essere implementata come comando Rust.
 */
export const getDb = async (): Promise<any> => {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    // Tentativo di importare better-sqlite3 solo se disponibile
    // @ts-ignore - import dinamico opzionale
    const Database = await new Function('return import("better-sqlite3")')().catch(() => null);
    const { drizzle } = await new Function('return import("drizzle-orm/better-sqlite3")')().catch(() => null);
    
    if (!Database || !drizzle) {
      throw new Error('better-sqlite3 non disponibile nel browser');
    }

    const dataDir = await appDataDir();
    const dbPath = `${dataDir}/mail-client.db`;
    
    sqliteInstance = new Database.default(dbPath);
    sqliteInstance.pragma('journal_mode = WAL');
    sqliteInstance.pragma('foreign_keys = ON');

    dbInstance = drizzle(sqliteInstance, { schema });

  // Crea le tabelle se non esistono
  sqliteInstance.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      display_name TEXT NOT NULL,
      access_token BLOB NOT NULL,
      refresh_token BLOB NOT NULL,
      expires_at INTEGER NOT NULL,
      token_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      unread_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      sync_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      uid INTEGER NOT NULL,
      message_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      from_name TEXT,
      from_address TEXT NOT NULL,
      to_addresses TEXT NOT NULL,
      cc_addresses TEXT,
      bcc_addresses TEXT,
      date INTEGER NOT NULL,
      text TEXT,
      html TEXT,
      flags TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      is_starred INTEGER DEFAULT 0,
      is_important INTEGER DEFAULT 0,
      thread_id TEXT,
      in_reply_to TEXT,
      references TEXT,
      synced_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      content_id TEXT,
      content BLOB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_folder_id ON messages(folder_id);
    CREATE INDEX IF NOT EXISTS idx_messages_account_id ON messages(account_id);
    CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(date);
    CREATE INDEX IF NOT EXISTS idx_folders_account_id ON folders(account_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
  `);

    return dbInstance;
  } catch (error) {
    // Fallback: usa IndexedDB per il browser
    console.warn('SQLite non disponibile, usando IndexedDB come fallback:', error);
    
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      // Usa IndexedDB come fallback
      return getIndexedDbInstance();
    }
    
    throw new Error('Database non disponibile nel browser. IndexedDB non supportato.');
  }
};

/**
 * Ottiene un'istanza IndexedDB come fallback per il browser
 */
let indexedDbInstance: any | null = null;

const getIndexedDbInstance = async (): Promise<any> => {
  if (indexedDbInstance) {
    return indexedDbInstance;
  }

  const dbName = 'mail-client-db';
  const dbVersion = 1;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    
    request.onerror = () => {
      console.error('[IndexedDB] Errore nell\'apertura:', request.error);
      // Fallback a localStorage per account e settings
      console.log('[IndexedDB] Usando fallback localStorage');
      resolve(createLocalStorageFallback());
    };
    
    request.onsuccess = () => {
      const db = request.result;
      console.log('[IndexedDB] Database aperto, object stores:', Array.from(db.objectStoreNames));
      
      // Verifica che le tabelle esistano
      if (!db.objectStoreNames.contains('accounts')) {
        console.log('[IndexedDB] Object store "accounts" non trovato, richiesta upgrade...');
        // Chiudi e riapri con versione maggiore per triggerare onupgradeneeded
        db.close();
        const upgradeRequest = indexedDB.open(dbName, dbVersion + 1);
        upgradeRequest.onupgradeneeded = (event: any) => {
          const upgradeDb = event.target.result;
          console.log('[IndexedDB] Upgrade in corso, creazione object stores...');
          
          if (!upgradeDb.objectStoreNames.contains('accounts')) {
            upgradeDb.createObjectStore('accounts', { keyPath: 'id' });
            console.log('[IndexedDB] Creato object store "accounts"');
          }
          if (!upgradeDb.objectStoreNames.contains('folders')) {
            upgradeDb.createObjectStore('folders', { keyPath: 'id' });
          }
          if (!upgradeDb.objectStoreNames.contains('messages')) {
            upgradeDb.createObjectStore('messages', { keyPath: 'id' });
          }
          if (!upgradeDb.objectStoreNames.contains('settings')) {
            upgradeDb.createObjectStore('settings', { keyPath: 'key' });
          }
        };
        upgradeRequest.onsuccess = () => {
          console.log('[IndexedDB] Upgrade completato');
          indexedDbInstance = createIndexedDbWrapper(upgradeRequest.result);
          resolve(indexedDbInstance);
        };
        upgradeRequest.onerror = () => {
          console.error('[IndexedDB] Errore durante upgrade:', upgradeRequest.error);
          resolve(createLocalStorageFallback());
        };
      } else {
        console.log('[IndexedDB] Object stores già presenti, creazione wrapper...');
        indexedDbInstance = createIndexedDbWrapper(db);
        resolve(indexedDbInstance);
      }
    };
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      console.log('[IndexedDB] Upgrade necessario, creazione object stores...');
      
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'id' });
        console.log('[IndexedDB] Creato object store "accounts"');
      }
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
};

/**
 * Crea un wrapper IndexedDB compatibile con Drizzle
 */
const createIndexedDbWrapper = (db: IDBDatabase): any => {
  const getStoreName = (table: any): string => {
    // Drizzle espone il nome della tabella in diversi modi a seconda della versione
    // Prova diversi percorsi comuni
    if (table && typeof table === 'object') {
      // Prova table._.name (Drizzle v0.x)
      if (table._ && table._.name) {
        return table._.name;
      }
      // Prova table[Symbol.for('drizzle:Name')] (Drizzle v0.x alternativo)
      const drizzleNameSymbol = Symbol.for('drizzle:Name');
      if (table[drizzleNameSymbol]) {
        return table[drizzleNameSymbol];
      }
      // Prova table.name direttamente
      if (table.name) {
        return table.name;
      }
      // Prova table.dbName
      if (table.dbName) {
        return table.dbName;
      }
      // Prova a cercare nelle chiavi dell'oggetto
      const keys = Object.keys(table);
      for (const key of keys) {
        if (key === 'name' || key === 'dbName' || key === 'tableName') {
          return table[key];
        }
      }
      
      // Se la tabella ha una proprietà che contiene il nome (es. table._.name potrebbe essere accessibile diversamente)
      // Prova a cercare in table._.internal o altre strutture interne
      if (table._) {
        const underscoreKeys = Object.keys(table._);
        for (const key of underscoreKeys) {
          if (key === 'name' || key === 'dbName' || key === 'tableName') {
            return table._[key];
          }
        }
      }
    }
    // Fallback: prova a ottenere il nome dalla tabella stessa se è una stringa
    if (typeof table === 'string') {
      return table;
    }
    
    // Debug: logga la struttura della tabella per capire come è organizzata
    console.error('[IndexedDB] Impossibile determinare il nome della tabella. Struttura:', {
      keys: table ? Object.keys(table) : null,
      hasUnderscore: table && table._ ? Object.keys(table._) : null,
      tableType: typeof table,
      tableConstructor: table?.constructor?.name,
    });
    
    // Fallback finale: usa un nome di default basato su un hash o un identificatore
    // Per ora, proviamo a usare 'accounts' come fallback se la tabella è schema.accounts
    // Questo è un workaround temporaneo
    if (table && table === schema.accounts) {
      return 'accounts';
    }
    if (table && table === schema.folders) {
      return 'folders';
    }
    if (table && table === schema.messages) {
      return 'messages';
    }
    if (table && table === schema.settings) {
      return 'settings';
    }
    
    throw new Error('Impossibile determinare il nome della tabella');
  };

  return {
    insert: (table: any) => {
      const storeName = getStoreName(table);
      
      return {
        values: (values: any) => {
          // Drizzle può passare un oggetto singolo o un array
          // Se è un oggetto singolo, convertilo in array
          const valuesArray = Array.isArray(values) ? values : [values];
          
          console.log('[IndexedDB] Insert values chiamato per', storeName, 'con', valuesArray.length, 'valori');
          
          // Restituisce un oggetto con onConflictDoUpdate
          return {
            onConflictDoUpdate: (options: any) => ({
              set: async (updates: any) => {
                console.log('[IndexedDB] onConflictDoUpdate.set chiamato per', storeName, 'con updates:', Object.keys(updates));
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                
                // Per ogni valore, applica gli aggiornamenti e salva (put fa upsert)
                for (const value of valuesArray) {
                  await new Promise((resolve, reject) => {
                    // Merge con gli aggiornamenti
                    const updatedValue = { ...value, ...updates };
                    console.log('[IndexedDB] Salvataggio valore in', storeName, ':', {
                      id: updatedValue.id,
                      email: updatedValue.email,
                      accessTokenLength: updatedValue.accessToken?.length || updatedValue.accessToken?.byteLength,
                    });
                    const request = store.put(updatedValue);
                    request.onsuccess = () => {
                      console.log('[IndexedDB] Valore salvato con successo in', storeName);
                      resolve(undefined);
                    };
                    request.onerror = () => {
                      console.error('[IndexedDB] Errore nel salvataggio:', request.error);
                      reject(request.error);
                    };
                  });
                }
                console.log('[IndexedDB] Tutti i valori salvati in', storeName);
              },
            }),
            // Se viene chiamato direttamente senza onConflictDoUpdate, inserisci i valori
            then: async (onResolve?: any, onReject?: any) => {
              try {
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                
                // Put fa upsert automaticamente in IndexedDB
                for (const value of valuesArray) {
                  await new Promise((resolve, reject) => {
                    const request = store.put(value);
                    request.onsuccess = () => resolve(undefined);
                    request.onerror = () => reject(request.error);
                  });
                }
                return onResolve ? onResolve(undefined) : undefined;
              } catch (error) {
                if (onReject) {
                  return onReject(error);
                }
                throw error;
              }
            },
          };
        },
      };
    },
    select: () => ({
      from: (table: any) => {
        const storeName = getStoreName(table);
        
        return {
          where: (condition: any) => ({
            limit: async (count: number) => {
              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              
              return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                  let results = request.result;
                  
                  // Applica il filtro where se presente
                  if (condition) {
                    // Gestisce eq() per uguaglianza
                    if (condition._ && condition._.op === 'eq') {
                      const column = condition._.left?.name || condition._.left?.column?.name;
                      const value = condition._.right?.value;
                      if (column && value !== undefined) {
                        results = results.filter((row: any) => row[column] === value);
                      }
                    }
                    // Gestisce and() per condizioni multiple
                    if (condition._ && condition._.op === 'and') {
                      const conditions = condition._.args || [];
                      for (const cond of conditions) {
                        if (cond._ && cond._.op === 'eq') {
                          const column = cond._.left?.name || cond._.left?.column?.name;
                          const value = cond._.right?.value;
                          if (column && value !== undefined) {
                            results = results.filter((row: any) => row[column] === value);
                          }
                        }
                      }
                    }
                  }
                  
                  // Applica il limite
                  if (count) {
                    results = results.slice(0, count);
                  }
                  
                  resolve(results);
                };
                request.onerror = () => reject(request.error);
              });
            },
          }),
          // Se non c'è where, restituisce tutti i risultati
          then: async (onResolve?: any, onReject?: any) => {
            try {
              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              
              const results = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              });
              
              // Se onResolve è una funzione, chiamala, altrimenti restituisci i risultati
              if (typeof onResolve === 'function') {
                return onResolve(results);
              }
              return results;
            } catch (error) {
              if (onReject) {
                return onReject(error);
              }
              throw error;
            }
          },
          // Supporta anche la chiamata diretta come Promise
          catch: async (onReject?: any) => {
            try {
              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              
              const results = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              });
              
              return results;
            } catch (error) {
              if (onReject) {
                return onReject(error);
              }
              throw error;
            }
          },
        };
      },
    }),
    delete: (table: any) => ({
      where: async (condition: any) => {
        const storeName = getStoreName(table);
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        // Ottieni tutti i record e filtra
        const all = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }) as any[];
        
        // Applica il filtro where
        let toDelete: any[] = [];
        if (condition) {
          if (condition._ && condition._.op === 'eq') {
            const column = condition._.left?.name || condition._.left?.column?.name;
            const value = condition._.right?.value;
            if (column && value !== undefined) {
              toDelete = all.filter((row: any) => row[column] === value);
            }
          } else {
            toDelete = all;
          }
        } else {
          toDelete = all;
        }
        
        // Elimina i record filtrati
        for (const item of toDelete) {
          await new Promise((resolve, reject) => {
            const request = store.delete(item.id || item.key);
            request.onsuccess = () => resolve(undefined);
            request.onerror = () => reject(request.error);
          });
        }
      },
    }),
  };
};

/**
 * Crea un fallback con localStorage (solo per account e settings)
 */
const createLocalStorageFallback = (): any => {
  const getStoreName = (table: any): string => {
    if (table && table._ && table._.name) {
      return table._.name;
    }
    if (typeof table === 'string') {
      return table;
    }
    throw new Error('Impossibile determinare il nome della tabella');
  };

  return {
    insert: (table: any) => {
      const storeName = getStoreName(table);
      
      const insertObj = {
        values: async (values: any[]) => {
          const key = `mail-client-${storeName}`;
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          
          // Salva i valori per onConflictDoUpdate
          (insertObj as any)._savedValues = values;
          
          // Rimuovi duplicati basati sull'ID e aggiorna quelli esistenti
          const existingMap = new Map(existing.map((item: any) => [(item.id || item.key), item]));
          
          for (const value of values) {
            const id = value.id || value.key;
            if (existingMap.has(id)) {
              // Aggiorna il record esistente
              existingMap.set(id, { ...existingMap.get(id), ...value });
            } else {
              // Aggiungi nuovo record
              existingMap.set(id, value);
            }
          }
          
          const updated = Array.from(existingMap.values());
          localStorage.setItem(key, JSON.stringify(updated));
          
          // Restituisce un oggetto con onConflictDoUpdate
          return {
            onConflictDoUpdate: (options: any) => ({
              set: async (updates: any) => {
                const key2 = `mail-client-${storeName}`;
                const existing2 = JSON.parse(localStorage.getItem(key2) || '[]');
                const savedValues = (insertObj as any)._savedValues || values;
                
                // Aggiorna i record esistenti con i nuovi valori
                const existingMap2 = new Map(existing2.map((item: any) => [(item.id || item.key), item]));
                
                for (const value of savedValues) {
                  const id = value.id || value.key;
                  if (existingMap2.has(id)) {
                    // Merge con gli aggiornamenti
                    existingMap2.set(id, { ...existingMap2.get(id), ...value, ...updates });
                  } else {
                    // Aggiungi nuovo record con aggiornamenti
                    existingMap2.set(id, { ...value, ...updates });
                  }
                }
                
                const updated2 = Array.from(existingMap2.values());
                localStorage.setItem(key2, JSON.stringify(updated2));
              },
            }),
          };
        },
      };
      
      return insertObj;
    },
    select: () => ({
      from: (table: any) => {
        const storeName = getStoreName(table);
        
        return {
          where: (condition: any) => ({
            limit: async (count: number) => {
              const key = `mail-client-${storeName}`;
              let results = JSON.parse(localStorage.getItem(key) || '[]');
              
              // Applica il filtro where
              if (condition) {
                if (condition._ && condition._.op === 'eq') {
                  const column = condition._.left?.name || condition._.left?.column?.name;
                  const value = condition._.right?.value;
                  if (column && value !== undefined) {
                    results = results.filter((row: any) => row[column] === value);
                  }
                }
              }
              
              // Applica il limite
              if (count) {
                results = results.slice(0, count);
              }
              
              return results;
            },
          }),
          then: async (onResolve: any, onReject?: any) => {
            try {
              const key = `mail-client-${storeName}`;
              const results = JSON.parse(localStorage.getItem(key) || '[]');
              return onResolve ? onResolve(results) : results;
            } catch (error) {
              if (onReject) {
                return onReject(error);
              }
              throw error;
            }
          },
        };
      },
    }),
    delete: (table: any) => ({
      where: async (condition: any) => {
        const storeName = getStoreName(table);
        const key = `mail-client-${storeName}`;
        let existing = JSON.parse(localStorage.getItem(key) || '[]');
        
        // Applica il filtro where
        if (condition) {
          if (condition._ && condition._.op === 'eq') {
            const column = condition._.left?.name || condition._.left?.column?.name;
            const value = condition._.right?.value;
            if (column && value !== undefined) {
              existing = existing.filter((row: any) => row[column] !== value);
            }
          }
        }
        
        localStorage.setItem(key, JSON.stringify(existing));
      },
    }),
  };
};


/**
 * Chiude la connessione al database
 */
export const closeDb = (): void => {
  if (sqliteInstance) {
    sqliteInstance.close();
    sqliteInstance = null;
    dbInstance = null;
  }
};

export { schema };

