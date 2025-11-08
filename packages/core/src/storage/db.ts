/**
 * Inizializzazione database SQLite con fallback IndexedDB
 * Nota: better-sqlite3 è una libreria Node.js e non può essere eseguita nel browser.
 * In Tauri, questa logica dovrebbe usare IndexedDB o essere implementata come comando Rust.
 */

import * as schema from './schema';
import { appDataDir } from '../utils/paths';

let dbInstance: any | null = null;
let sqliteInstance: any | null = null;
let useIndexedDB = false;

/**
 * Implementazione IndexedDB come fallback
 */
class IndexedDBAdapter {
  private db: IDBDatabase | null = null;
  private dbName = 'mail-client-db';
  private version = 1;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB non disponibile'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Crea le tabelle (object stores)
        if (!db.objectStoreNames.contains('accounts')) {
          const accountsStore = db.createObjectStore('accounts', { keyPath: 'id' });
          accountsStore.createIndex('email', 'email', { unique: true });
        }

        if (!db.objectStoreNames.contains('folders')) {
          const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
          foldersStore.createIndex('accountId', 'accountId', { unique: false });
        }

        if (!db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
          messagesStore.createIndex('folderId', 'folderId', { unique: false });
          messagesStore.createIndex('accountId', 'accountId', { unique: false });
          messagesStore.createIndex('date', 'date', { unique: false });
        }

        if (!db.objectStoreNames.contains('attachments')) {
          db.createObjectStore('attachments', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  getDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database non inizializzato');
    }
    return this.db;
  }
}

const indexedDBAdapter = new IndexedDBAdapter();

/**
 * Ottiene l'istanza del database (singleton)
 * Nota: Questa funzione richiede better-sqlite3 che è disponibile solo in Node.js.
 * In Tauri, questa logica dovrebbe usare IndexedDB o essere implementata come comando Rust.
 */
export const getDb = async (): Promise<any> => {
  if (dbInstance && !useIndexedDB) {
    return dbInstance;
  }

  if (useIndexedDB) {
    try {
      await indexedDBAdapter.init();
      return createIndexedDbWrapper(indexedDBAdapter.getDb());
    } catch (error) {
      console.error('[IndexedDB] Errore nell\'inizializzazione:', error);
      throw error;
    }
  }

  try {
    // Tentativo di importare better-sqlite3 solo se disponibile
    // @ts-ignore - import dinamico opzionale
    const DatabaseModule = await new Function('return import("better-sqlite3")')().catch(() => null);
    // @ts-ignore - import dinamico opzionale
    const drizzleModule = await new Function('return import("drizzle-orm/better-sqlite3")')().catch(() => null);
    
    if (!DatabaseModule || !drizzleModule) {
      throw new Error('better-sqlite3 non disponibile');
    }

    const Database = DatabaseModule.default;
    const { drizzle } = drizzleModule;

    const dataDir = await appDataDir();
    const dbPath = `${dataDir}/mail-client.db`;
    
    sqliteInstance = new Database(dbPath);
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
    useIndexedDB = true;
    
    try {
      await indexedDBAdapter.init();
      return createIndexedDbWrapper(indexedDBAdapter.getDb());
    } catch (idbError) {
      throw new Error('Database non disponibile. IndexedDB fallback fallito.');
    }
  }
};

/**
 * Crea un wrapper IndexedDB compatibile con Drizzle
 */
const createIndexedDbWrapper = (db: IDBDatabase): any => {
  const getStoreName = (table: any): string => {
    // Drizzle espone il nome della tabella in diversi modi a seconda della versione
    if (table && typeof table === 'object') {
      if (table._ && table._.name) {
        return table._.name;
      }
      const drizzleNameSymbol = Symbol.for('drizzle:Name');
      if (table[drizzleNameSymbol]) {
        return table[drizzleNameSymbol];
      }
      if (table.name) {
        return table.name;
      }
      if (table.dbName) {
        return table.dbName;
      }
    }
    if (typeof table === 'string') {
      return table;
    }
    
    // Fallback: confronta con schema
    if (table === schema.accounts) return 'accounts';
    if (table === schema.folders) return 'folders';
    if (table === schema.messages) return 'messages';
    if (table === schema.settings) return 'settings';
    if (table === schema.attachments) return 'attachments';
    
    throw new Error('Impossibile determinare il nome della tabella');
  };

  return {
    insert: (table: any) => {
      const storeName = getStoreName(table);
      
      return {
        values: (values: any) => {
          const valuesArray = Array.isArray(values) ? values : [values];
          
          return {
            onConflictDoUpdate: (options: any) => ({
              set: async (updates: any) => {
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                
                for (const value of valuesArray) {
                  await new Promise((resolve, reject) => {
                    const updatedValue = { ...value, ...updates };
                    const request = store.put(updatedValue);
                    request.onsuccess = () => resolve(undefined);
                    request.onerror = () => reject(request.error);
                  });
                }
              },
            }),
            then: async (onResolve?: any, onReject?: any) => {
              try {
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                
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
        
        const query = {
          where: (condition: any) => ({
            limit: async (count: number) => {
              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              
              return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                  let results = request.result;
                  
                  if (condition) {
                    if (condition._ && condition._.op === 'eq') {
                      const column = condition._.left?.name || condition._.left?.column?.name;
                      const value = condition._.right?.value;
                      if (column && value !== undefined) {
                        results = results.filter((row: any) => row[column] === value);
                      }
                    }
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
                  
                  if (count) {
                    results = results.slice(0, count);
                  }
                  
                  resolve(results);
                };
                request.onerror = () => reject(request.error);
              });
            },
            then: async (onResolve?: any, onReject?: any) => {
              try {
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                
                const results = await new Promise((resolve, reject) => {
                  const request = store.getAll();
                  request.onsuccess = () => resolve(request.result);
                  request.onerror = () => reject(request.error);
                }) as any[];
                
                let filtered = results;
                if (condition) {
                  if (condition._ && condition._.op === 'eq') {
                    const column = condition._.left?.name || condition._.left?.column?.name;
                    const value = condition._.right?.value;
                    if (column && value !== undefined) {
                      filtered = filtered.filter((row: any) => row[column] === value);
                    }
                  }
                }
                
                if (typeof onResolve === 'function') {
                  return onResolve(filtered);
                }
                return filtered;
              } catch (error) {
                if (onReject) {
                  return onReject(error);
                }
                throw error;
              }
            },
          }),
          then: async (onResolve?: any, onReject?: any) => {
            try {
              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              
              const results = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              });
              
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
          orderBy: (column: any, direction: 'asc' | 'desc' = 'desc') => ({
            limit: async (count: number) => {
              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              
              return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                  let results = request.result;
                  
                  const columnName = column?.name || column?.column?.name || 'date';
                  results.sort((a: any, b: any) => {
                    const aVal = a[columnName] || 0;
                    const bVal = b[columnName] || 0;
                    if (direction === 'desc') {
                      return bVal - aVal;
                    }
                    return aVal - bVal;
                  });
                  
                  if (count) {
                    results = results.slice(0, count);
                  }
                  
                  resolve(results);
                };
                request.onerror = () => reject(request.error);
              });
            },
            then: async (onResolve?: any, onReject?: any) => {
              try {
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                
                const results = await new Promise((resolve, reject) => {
                  const request = store.getAll();
                  request.onsuccess = () => resolve(request.result);
                  request.onerror = () => reject(request.error);
                }) as any[];
                
                const columnName = column?.name || column?.column?.name || 'date';
                results.sort((a: any, b: any) => {
                  const aVal = a[columnName] || 0;
                  const bVal = b[columnName] || 0;
                  if (direction === 'desc') {
                    return bVal - aVal;
                  }
                  return aVal - bVal;
                });
                
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
          }),
        };
        
        return query;
      },
    }),
    update: (table: any) => ({
      set: (updates: any) => ({
        where: async (condition: any) => {
          const storeName = getStoreName(table);
          const transaction = db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          
          const all = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          }) as any[];
          
          let toUpdate: any[] = [];
          if (condition) {
            if (condition._ && condition._.op === 'eq') {
              const column = condition._.left?.name || condition._.left?.column?.name;
              const value = condition._.right?.value;
              if (column && value !== undefined) {
                toUpdate = all.filter((row: any) => row[column] === value);
              }
            }
          }
          
          for (const item of toUpdate) {
            await new Promise((resolve, reject) => {
              const updated = { ...item, ...updates };
              const request = store.put(updated);
              request.onsuccess = () => resolve(undefined);
              request.onerror = () => reject(request.error);
            });
          }
        },
      }),
    }),
    delete: (table: any) => ({
      where: async (condition: any) => {
        const storeName = getStoreName(table);
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const all = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }) as any[];
        
        let toDelete: any[] = [];
        if (condition) {
          if (condition._ && condition._.op === 'eq') {
            const column = condition._.left?.name || condition._.left?.column?.name;
            const value = condition._.right?.value;
            if (column && value !== undefined) {
              toDelete = all.filter((row: any) => row[column] === value);
            }
          }
        } else {
          toDelete = all;
        }
        
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
