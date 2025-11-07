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
    // Fallback: usa IndexedDB o localStorage per il browser
    console.warn('SQLite non disponibile, usando fallback:', error);
    // TODO: Implementare fallback con IndexedDB
    throw new Error('Database non disponibile nel browser. Implementare fallback con IndexedDB o comando Tauri.');
  }
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

