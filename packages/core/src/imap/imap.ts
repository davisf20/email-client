/**
 * Client IMAP per la sincronizzazione delle email
 * Nota: imapflow è una libreria Node.js e non può essere eseguita nel browser.
 * Questa logica dovrebbe essere spostata in comandi Rust di Tauri.
 */

import type { Account, MailMessage, MailFolder } from '../types';

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    accessToken: string;
  };
}

/**
 * Ottiene la configurazione IMAP per un provider
 * Nota: Non utilizzato attualmente, mantenuto per riferimento futuro
 */
// @ts-ignore - Funzione non utilizzata ma mantenuta per riferimento
const _getImapConfig = (_provider: 'gmail' | 'outlook', _email: string, _accessToken: string): ImapConfig => {
  const provider = _provider;
  const email = _email;
  const accessToken = _accessToken;
  if (provider === 'gmail') {
    return {
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: email,
        accessToken,
      },
    };
  }

  if (provider === 'outlook') {
    return {
      host: 'outlook.office365.com',
      port: 993,
      secure: true,
      auth: {
        user: email,
        accessToken,
      },
    };
  }

  throw new Error(`Provider non supportato: ${provider}`);
};

/**
 * Crea un client IMAP connesso
 * Nota: Questa funzione richiede imapflow che è disponibile solo in Node.js.
 * In Tauri, questa logica dovrebbe essere implementata come comando Rust.
 */
export const createImapClient = async (
  _account: Account
): Promise<any> => {
  // TODO: Implementare come comando Tauri Rust
  throw new Error('IMAP client non disponibile nel browser. Implementare come comando Tauri.');
};

// Lock per evitare chiamate multiple simultanee a syncFolders per lo stesso account
const syncFoldersLocks = new Map<string, Promise<MailFolder[]>>();

/**
 * Sincronizza le cartelle di un account
 * Usa i comandi Tauri se disponibili, altrimenti fallback a mock
 * Evita chiamate multiple simultanee per lo stesso account
 */
export const syncFolders = async (account: Account): Promise<MailFolder[]> => {
  // Se c'è già una chiamata in corso per questo account, restituisci quella promessa
  const existingLock = syncFoldersLocks.get(account.id);
  if (existingLock) {
    console.log('[IMAP] Chiamata syncFolders già in corso per account:', account.email, '- riuso la promessa esistente');
    return existingLock;
  }
  
  // Crea una nuova promessa e la aggiungi al lock
  const syncPromise = (async () => {
    try {
      // Prova a usare i comandi Tauri se disponibili
      try {
        // Controlla se siamo in ambiente Tauri - verifica che window.__TAURI__ esista
        // Questo è il modo più affidabile per verificare se siamo in Tauri
        const isTauri = typeof window !== 'undefined' && 
                        ((window as any).__TAURI__ !== undefined || 
                         (window as any).__TAURI_INTERNALS__ !== undefined);
        
        console.log('[IMAP] Controllo Tauri:', { 
          isTauri, 
          hasWindow: typeof window !== 'undefined',
          hasTAURI: typeof window !== 'undefined' ? (window as any).__TAURI__ !== undefined : false,
          hasTAURI_INTERNALS: typeof window !== 'undefined' ? (window as any).__TAURI_INTERNALS__ !== undefined : false,
        });
        
        if (isTauri) {
          console.log('[IMAP] Tauri disponibile, uso comandi Rust');
          const { syncFoldersTauri } = await import('./tauri-imap');
          const folders = await syncFoldersTauri(account);
          console.log('[IMAP] Cartelle sincronizzate da Rust:', folders.length);
          return folders;
        } else {
          console.warn('[IMAP] Tauri non disponibile, uso mock. Assicurati di usare "pnpm tauri:dev" invece di "pnpm dev"');
        }
      } catch (error) {
        console.error('[IMAP] Errore nei comandi Tauri, uso mock:', error);
      }
      
      // Fallback a mock per sviluppo/test
      console.log('[IMAP Mock] Sincronizzazione cartelle per account:', account.email);
      
      // Cartelle mock per testare l'UI
      const mockFolders: MailFolder[] = [
        {
          id: `${account.id}-inbox`,
          accountId: account.id,
          name: 'INBOX',
          path: 'INBOX',
          unreadCount: 0,
          totalCount: 0,
          syncAt: Date.now(),
        },
        {
          id: `${account.id}-sent`,
          accountId: account.id,
          name: 'Sent',
          path: '[Gmail]/Sent Mail',
          unreadCount: 0,
          totalCount: 0,
          syncAt: Date.now(),
        },
        {
          id: `${account.id}-drafts`,
          accountId: account.id,
          name: 'Drafts',
          path: '[Gmail]/Drafts',
          unreadCount: 0,
          totalCount: 0,
          syncAt: Date.now(),
        },
        {
          id: `${account.id}-archive`,
          accountId: account.id,
          name: 'Archive',
          path: '[Gmail]/All Mail',
          unreadCount: 0,
          totalCount: 0,
          syncAt: Date.now(),
        },
      ];
      
      return mockFolders;
    } finally {
      // Rimuovi il lock quando la chiamata è completata (sia con successo che con errore)
      syncFoldersLocks.delete(account.id);
      console.log('[IMAP] Lock rimosso per account:', account.email);
    }
  })();
  
  // Aggiungi la promessa al lock
  syncFoldersLocks.set(account.id, syncPromise);
  console.log('[IMAP] Lock creato per account:', account.email);
  
  return syncPromise;
};

/**
 * Sincronizza i messaggi di una cartella
 * Usa i comandi Tauri se disponibili, altrimenti fallback a mock
 */
export const syncMessages = async (
  account: Account,
  folderPath: string,
  since?: Date
): Promise<MailMessage[]> => {
  // Prova a usare i comandi Tauri se disponibili
  try {
    // Controlla se siamo in ambiente Tauri - verifica che invoke sia disponibile e funzionante
    let isTauri = false;
    try {
      // Prova a importare invoke direttamente
      const { invoke } = await import('@tauri-apps/api/core');
      if (invoke && typeof invoke === 'function') {
        // Verifica che window.__TAURI__ esista (necessario per Tauri)
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
          isTauri = true;
        }
      }
    } catch {
      // Se l'import fallisce, non siamo in Tauri
      isTauri = false;
    }
    
    // Fallback: controlla anche window.__TAURI__
    if (!isTauri && typeof window !== 'undefined') {
      isTauri = (window as any).__TAURI__ !== undefined || 
                (window as any).__TAURI_INTERNALS__ !== undefined;
    }
    
    console.log('[IMAP] Controllo Tauri per syncMessages:', { 
      isTauri, 
      hasWindow: typeof window !== 'undefined',
      hasTAURI: typeof window !== 'undefined' ? (window as any).__TAURI__ !== undefined : false,
    });
    
    if (isTauri) {
      console.log('[IMAP] Tauri disponibile, uso comandi Rust per sincronizzare messaggi');
      const { syncMessagesTauri } = await import('./tauri-imap');
      const messages = await syncMessagesTauri(account, folderPath, since);
      console.log('[IMAP] Messaggi sincronizzati da Rust:', messages.length);
      return messages;
    } else {
      console.warn('[IMAP] Tauri non disponibile, uso mock. Assicurati di usare "pnpm tauri:dev" invece di "pnpm dev"');
    }
  } catch (error) {
    console.error('[IMAP] Errore nei comandi Tauri, uso mock:', error);
  }
  
  // Fallback a mock per sviluppo/test
  console.log('[IMAP Mock] Sincronizzazione messaggi per cartella:', folderPath, 'account:', account.email);
  
  // Messaggi mock per testare l'UI
  // Determina il folderId corretto in base al folderPath
  let folderId = `${account.id}-inbox`;
  if (folderPath.toLowerCase().includes('sent')) {
    folderId = `${account.id}-sent`;
  } else if (folderPath.toLowerCase().includes('draft')) {
    folderId = `${account.id}-drafts`;
  } else if (folderPath.toLowerCase().includes('archive') || folderPath.toLowerCase().includes('all mail')) {
    folderId = `${account.id}-archive`;
  } else if (folderPath === 'INBOX' || folderPath.toLowerCase().includes('inbox')) {
    folderId = `${account.id}-inbox`;
  }
  
  const mockMessages: MailMessage[] = [
    {
      id: `${account.id}-msg-1`,
      accountId: account.id,
      folderId: folderId,
      uid: 1,
      messageId: 'mock-message-id-1',
      subject: 'Benvenuto nella tua nuova email client',
      from: {
        name: 'Mail Client Team',
        address: 'noreply@mailclient.com',
      },
      to: [
        {
          name: account.displayName,
          address: account.email,
        },
      ],
      date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 ore fa
      text: 'Benvenuto! Questa è una email di esempio per testare l\'interfaccia.',
      html: '<p>Benvenuto! Questa è una email di esempio per testare l\'interfaccia.</p>',
      attachments: [],
      flags: [],
      isRead: false,
      isStarred: false,
      isImportant: false,
      syncedAt: Date.now(),
    },
    {
      id: `${account.id}-msg-2`,
      accountId: account.id,
      folderId: folderId,
      uid: 2,
      messageId: 'mock-message-id-2',
      subject: 'Come iniziare a usare il client email',
      from: {
        name: 'Support Team',
        address: 'support@mailclient.com',
      },
      to: [
        {
          name: account.displayName,
          address: account.email,
        },
      ],
      date: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 ore fa
      text: 'Ecco alcune informazioni utili per iniziare...',
      html: '<p>Ecco alcune informazioni utili per iniziare...</p>',
      attachments: [],
      flags: ['\\Seen'],
      isRead: true,
      isStarred: true,
      isImportant: false,
      syncedAt: Date.now(),
    },
    {
      id: `${account.id}-msg-3`,
      accountId: account.id,
      folderId: folderId,
      uid: 3,
      messageId: 'mock-message-id-3',
      subject: 'Aggiornamento importante',
      from: {
        name: 'System',
        address: 'system@mailclient.com',
      },
      to: [
        {
          name: account.displayName,
          address: account.email,
        },
      ],
      date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 giorno fa
      text: 'Questo è un messaggio importante con allegato.',
      html: '<p>Questo è un messaggio importante con allegato.</p>',
      attachments: [
        {
          filename: 'documento.pdf',
          contentType: 'application/pdf',
          size: 102400,
          content: Buffer.from(new Uint8Array(1024)), // Mock content
        },
      ],
      flags: ['\\Seen', '\\Important'],
      isRead: true,
      isStarred: false,
      isImportant: true,
      syncedAt: Date.now(),
    },
    {
      id: `${account.id}-msg-4`,
      accountId: account.id,
      folderId: folderId,
      uid: 4,
      messageId: 'mock-message-id-4',
      subject: 'Riunione di team - Prossima settimana',
      from: {
        name: 'John Doe',
        address: 'john.doe@example.com',
      },
      to: [
        {
          name: account.displayName,
          address: account.email,
        },
        {
          name: 'Jane Smith',
          address: 'jane.smith@example.com',
        },
      ],
      cc: [
        {
          name: 'Team Lead',
          address: 'teamlead@example.com',
        },
      ],
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 giorni fa
      text: 'Ciao, vorrei organizzare una riunione di team per la prossima settimana...',
      html: '<p>Ciao, vorrei organizzare una riunione di team per la prossima settimana...</p>',
      attachments: [],
      flags: ['\\Seen'],
      isRead: true,
      isStarred: false,
      isImportant: false,
      syncedAt: Date.now(),
    },
    {
      id: `${account.id}-msg-5`,
      accountId: account.id,
      folderId: folderId,
      uid: 5,
      messageId: 'mock-message-id-5',
      subject: 'Newsletter settimanale',
      from: {
        name: 'Newsletter',
        address: 'newsletter@example.com',
      },
      to: [
        {
          name: account.displayName,
          address: account.email,
        },
      ],
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 settimana fa
      text: 'Ecco le ultime notizie della settimana...',
      html: '<div><h2>Newsletter Settimanale</h2><p>Ecco le ultime notizie della settimana...</p></div>',
      attachments: [],
      flags: ['\\Seen'],
      isRead: true,
      isStarred: false,
      isImportant: false,
      syncedAt: Date.now(),
    },
  ];
  
  // Filtra i messaggi in base alla cartella
  // Per INBOX, restituisci tutti i messaggi mock (esclusi quelli con flag \Sent o \Draft)
  if (folderPath === 'INBOX' || folderPath.toLowerCase().includes('inbox')) {
    return mockMessages.filter(msg => 
      !msg.flags.includes('\\Sent') && !msg.flags.includes('\\Draft')
    );
  }
  
  // Per Sent, restituisci solo i messaggi con flag \Sent
  if (folderPath.toLowerCase().includes('sent')) {
    // Aggiungi flag \Sent ai messaggi per la cartella Sent
    return mockMessages.map(msg => ({
      ...msg,
      flags: [...msg.flags, '\\Sent'],
    }));
  }
  
  // Per Drafts, restituisci solo i messaggi con flag \Draft
  if (folderPath.toLowerCase().includes('draft')) {
    // Aggiungi flag \Draft ai messaggi per la cartella Drafts
    return mockMessages.map(msg => ({
      ...msg,
      flags: [...msg.flags, '\\Draft'],
    }));
  }
  
  // Per Archive/All Mail, restituisci tutti i messaggi
  if (folderPath.toLowerCase().includes('archive') || folderPath.toLowerCase().includes('all mail')) {
    return mockMessages;
  }
  
  // Per altre cartelle, restituisci array vuoto
  return [];
};

/**
 * Marca un messaggio come letto/non letto
 * Nota: Questa funzione richiede imapflow che è disponibile solo in Node.js.
 * In Tauri, questa logica dovrebbe essere implementata come comando Rust.
 */
export const markMessageAsRead = async (
  _account: Account,
  _folderPath: string,
  _uid: number,
  _read: boolean
): Promise<void> => {
  // TODO: Implementare come comando Tauri Rust
  console.warn('markMessageAsRead non disponibile nel browser. Implementare come comando Tauri.');
};

/**
 * Elimina un messaggio
 * Nota: Questa funzione richiede imapflow che è disponibile solo in Node.js.
 * In Tauri, questa logica dovrebbe essere implementata come comando Rust.
 */
export const deleteMessage = async (
  _account: Account,
  _folderPath: string,
  _uid: number
): Promise<void> => {
  // TODO: Implementare come comando Tauri Rust
  console.warn('deleteMessage non disponibile nel browser. Implementare come comando Tauri.');
};
