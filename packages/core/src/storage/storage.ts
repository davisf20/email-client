/**
 * Storage manager per account, messaggi e impostazioni
 */

import { eq } from 'drizzle-orm';
import { getDb, schema } from './db';
import type { Account, MailMessage, MailFolder, AppSettings, OAuthTokens } from '../types';
import { encrypt, decrypt } from '../utils/encryption';

/**
 * Gestione account
 */
export const accountStorage = {
  async save(account: Account): Promise<void> {
    console.log('[Storage] Salvataggio account:', account.id, account.email);
    const db = await getDb();
    
    const encryptedAccessToken = await encrypt(account.tokens.accessToken);
    const encryptedRefreshToken = await encrypt(account.tokens.refreshToken);

    console.log('[Storage] Token crittografati, accessToken length:', encryptedAccessToken.length);

    const accountData = {
      id: account.id,
      email: account.email,
      provider: account.provider,
      displayName: account.displayName,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: account.tokens.expiresAt,
      tokenType: account.tokens.tokenType,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };

    console.log('[Storage] Dati account da salvare:', {
      id: accountData.id,
      email: accountData.email,
      provider: accountData.provider,
      displayName: accountData.displayName,
      accessTokenType: Array.isArray(accountData.accessToken) ? 'Array' : typeof accountData.accessToken,
      accessTokenLength: accountData.accessToken.length || accountData.accessToken.byteLength,
    });

    try {
      const insertResult = db.insert(schema.accounts).values(accountData);
      const onConflictResult = insertResult.onConflictDoUpdate({
        target: schema.accounts.id,
        set: {
          displayName: account.displayName,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt: account.tokens.expiresAt,
          updatedAt: account.updatedAt,
        },
      });
      
      // onConflictDoUpdate restituisce un oggetto con metodo set() che restituisce una Promise
      if (onConflictResult && typeof onConflictResult.set === 'function') {
        await onConflictResult.set({
          displayName: account.displayName,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt: account.tokens.expiresAt,
          updatedAt: account.updatedAt,
        });
      } else if (onConflictResult && typeof onConflictResult.then === 'function') {
        // Fallback: se restituisce direttamente una Promise
        await onConflictResult;
      }
      
      console.log('[Storage] Account salvato con successo');
      
      // Crea cartelle e messaggi di esempio per il nuovo account
      await createSampleData(account);
    } catch (error) {
      console.error('[Storage] Errore nel salvataggio dell\'account:', error);
      throw error;
    }
  },

  async get(id: string): Promise<Account | null> {
    const db = await getDb();
    const result = await db.select().from(schema.accounts).where(eq(schema.accounts.id, id)).limit(1);
    
    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      email: row.email,
      provider: row.provider as 'gmail' | 'outlook',
      displayName: row.displayName,
      tokens: {
        accessToken: await decrypt(row.accessToken as Buffer | Uint8Array),
        refreshToken: await decrypt(row.refreshToken as Buffer | Uint8Array),
        expiresAt: row.expiresAt,
        tokenType: row.tokenType,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  async getAll(): Promise<Account[]> {
    const db = await getDb();
    
    // Per IndexedDB, select().from() restituisce un oggetto con then()
    let results: any[];
    try {
      const selectQuery = db.select().from(schema.accounts);
      // Se ha un metodo then, è thenable (Promise-like)
      if (selectQuery && typeof selectQuery.then === 'function') {
        results = await selectQuery;
      } else {
        // Altrimenti prova a chiamarlo direttamente
        results = selectQuery;
      }
      // Assicurati che sia un array
      results = Array.isArray(results) ? results : [];
    } catch (error) {
      console.error('[Storage] Errore nel caricamento degli account:', error);
      results = [];
    }

    console.log('[Storage] Account trovati:', results.length, results);

    return Promise.all(results.map(async (row) => {
      try {
        return {
          id: row.id,
          email: row.email,
          provider: row.provider as 'gmail' | 'outlook',
          displayName: row.displayName,
          tokens: {
            accessToken: await decrypt(row.accessToken as Buffer | Uint8Array),
            refreshToken: await decrypt(row.refreshToken as Buffer | Uint8Array),
            expiresAt: row.expiresAt,
            tokenType: row.tokenType,
          },
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      } catch (error) {
        console.error('[Storage] Errore nel decrittazione dell\'account:', row.id, error);
        throw error;
      }
    }));
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    console.log('[Storage] Rimozione account dal database:', id);
    await db.delete(schema.accounts).where(eq(schema.accounts.id, id));
    
    // Verifica che l'account sia stato rimosso
    const remaining = await this.getAll();
    const stillExists = remaining.some(a => a.id === id);
    if (stillExists) {
      console.error('[Storage] ERRORE: Account ancora presente dopo la rimozione:', id);
      throw new Error('Impossibile rimuovere l\'account dal database');
    }
    console.log('[Storage] Account rimosso con successo dal database:', id);
  },

  async updateTokens(id: string, tokens: OAuthTokens): Promise<void> {
    const db = await getDb();
    const encryptedAccessToken = await encrypt(tokens.accessToken);
    const encryptedRefreshToken = await encrypt(tokens.refreshToken);

    await db
      .update(schema.accounts)
      .set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokens.expiresAt,
        tokenType: tokens.tokenType,
        updatedAt: Date.now(),
      })
      .where(eq(schema.accounts.id, id));
  },
};

/**
 * Gestione cartelle
 */
export const folderStorage = {
  async save(folder: MailFolder): Promise<void> {
    const db = await getDb();
    await db.insert(schema.folders).values({
      id: folder.id,
      accountId: folder.accountId,
      name: folder.name,
      path: folder.path,
      unreadCount: folder.unreadCount,
      totalCount: folder.totalCount,
      syncAt: folder.syncAt,
    }).onConflictDoUpdate({
      target: schema.folders.id,
      set: {
        name: folder.name,
        unreadCount: folder.unreadCount,
        totalCount: folder.totalCount,
        syncAt: folder.syncAt,
      },
    });
  },

  async getByAccount(accountId: string): Promise<MailFolder[]> {
    const db = await getDb();
    const results = await db.select()
      .from(schema.folders)
      .where(eq(schema.folders.accountId, accountId));

    return results.map((row: any) => ({
      id: row.id,
      accountId: row.accountId,
      name: row.name,
      path: row.path,
      unreadCount: row.unreadCount || 0,
      totalCount: row.totalCount || 0,
      syncAt: row.syncAt || undefined,
    }));
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(schema.folders).where(eq(schema.folders.id, id));
  },
};

/**
 * Gestione messaggi
 */
export const messageStorage = {
  async save(message: MailMessage): Promise<void> {
    const db = await getDb();
    
    await db.insert(schema.messages).values({
      id: message.id,
      accountId: message.accountId,
      folderId: message.folderId,
      uid: message.uid,
      messageId: message.messageId,
      subject: message.subject,
      fromName: message.from.name,
      fromAddress: message.from.address,
      toAddresses: JSON.stringify(message.to),
      ccAddresses: message.cc ? JSON.stringify(message.cc) : null,
      bccAddresses: message.bcc ? JSON.stringify(message.bcc) : null,
      date: message.date.getTime(),
      text: message.text || null,
      html: message.html || null,
      flags: JSON.stringify(message.flags),
      isRead: message.isRead ? 1 : 0,
      isStarred: message.isStarred ? 1 : 0,
      isImportant: message.isImportant ? 1 : 0,
      threadId: message.threadId || null,
      inReplyTo: message.inReplyTo || null,
      references: message.references ? JSON.stringify(message.references) : null,
      syncedAt: message.syncedAt,
    }).onConflictDoUpdate({
      target: schema.messages.id,
      set: {
        folderId: message.folderId,
        flags: JSON.stringify(message.flags),
        isRead: message.isRead ? 1 : 0,
        isStarred: message.isStarred ? 1 : 0,
        isImportant: message.isImportant ? 1 : 0,
        syncedAt: message.syncedAt,
      },
    });

    // Salva allegati
    if (message.attachments.length > 0) {
      await db.delete(schema.attachments).where(eq(schema.attachments.messageId, message.id));
      
      for (const attachment of message.attachments) {
        await db.insert(schema.attachments).values({
          id: `${message.id}-${attachment.filename}`,
          messageId: message.id,
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          contentId: attachment.contentId || null,
          content: attachment.content,
        });
      }
    }
  },

  async getByFolder(folderId: string, limit = 50, offset = 0): Promise<MailMessage[]> {
    const db = await getDb();
    
    // Per IndexedDB, dobbiamo gestire orderBy, limit e offset manualmente
    let results: any[];
    try {
      const selectQuery = db.select().from(schema.messages);
      
      // Se ha un metodo then, è thenable (Promise-like)
      if (selectQuery && typeof selectQuery.then === 'function') {
        results = await selectQuery;
      } else {
        // Altrimenti prova a chiamarlo direttamente
        results = selectQuery;
      }
      
      // Assicurati che sia un array
      results = Array.isArray(results) ? results : [];
      
      // Filtra per folderId
      results = results.filter((row: any) => row.folderId === folderId);
      
      // Ordina per data (decrescente)
      results.sort((a: any, b: any) => {
        const dateA = a.date || 0;
        const dateB = b.date || 0;
        return dateB - dateA; // Decrescente
      });
      
      // Applica offset e limit
      results = results.slice(offset, offset + limit);
    } catch (error) {
      console.error('[Storage] Errore nel caricamento dei messaggi:', error);
      results = [];
    }

    const messages: MailMessage[] = [];

    for (const row of results) {
      // Carica gli attachments
      let attachments: any[] = [];
      try {
        const attachmentsQuery = db.select().from(schema.attachments);
        let allAttachments: any[];
        
        if (attachmentsQuery && typeof attachmentsQuery.then === 'function') {
          allAttachments = await attachmentsQuery;
        } else {
          allAttachments = attachmentsQuery;
        }
        
        allAttachments = Array.isArray(allAttachments) ? allAttachments : [];
        attachments = allAttachments.filter((a: any) => a.messageId === row.id);
      } catch (error) {
        console.error('[Storage] Errore nel caricamento degli attachments:', error);
        attachments = [];
      }

      messages.push({
        id: row.id,
        accountId: row.accountId,
        folderId: row.folderId,
        uid: row.uid,
        messageId: row.messageId,
        subject: row.subject,
        from: {
          name: row.fromName || undefined,
          address: row.fromAddress,
        },
        to: JSON.parse(row.toAddresses || '[]'),
        cc: row.ccAddresses ? JSON.parse(row.ccAddresses) : undefined,
        bcc: row.bccAddresses ? JSON.parse(row.bccAddresses) : undefined,
        date: new Date(row.date),
        text: row.text || undefined,
        html: row.html || undefined,
        attachments: attachments.map(a => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
          contentId: a.contentId || undefined,
          content: a.content as Buffer,
        })),
        flags: JSON.parse(row.flags || '[]'),
        isRead: row.isRead === 1,
        isStarred: row.isStarred === 1,
        isImportant: row.isImportant === 1,
        threadId: row.threadId || undefined,
        inReplyTo: row.inReplyTo || undefined,
        references: row.references ? JSON.parse(row.references) : undefined,
        syncedAt: row.syncedAt,
      });
    }

    console.log('[Storage] Messaggi caricati per cartella', folderId, ':', messages.length);
    return messages;
  },

  async get(id: string): Promise<MailMessage | null> {
    const db = await getDb();
    const results = await db.select()
      .from(schema.messages)
      .where(eq(schema.messages.id, id))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const row = results[0];
    const attachments = await db.select()
      .from(schema.attachments)
      .where(eq(schema.attachments.messageId, row.id));

    return {
      id: row.id,
      accountId: row.accountId,
      folderId: row.folderId,
      uid: row.uid,
      messageId: row.messageId,
      subject: row.subject,
      from: {
        name: row.fromName || undefined,
        address: row.fromAddress,
      },
      to: JSON.parse(row.toAddresses),
      cc: row.ccAddresses ? JSON.parse(row.ccAddresses) : undefined,
      bcc: row.bccAddresses ? JSON.parse(row.bccAddresses) : undefined,
      date: new Date(row.date),
      text: row.text || undefined,
      html: row.html || undefined,
      attachments: attachments.map((a: any) => ({
        filename: a.filename,
        contentType: a.contentType,
        size: a.size,
        contentId: a.contentId || undefined,
        content: a.content as Buffer,
      })),
      flags: JSON.parse(row.flags),
      isRead: row.isRead === 1,
      isStarred: row.isStarred === 1,
      isImportant: row.isImportant === 1,
      threadId: row.threadId || undefined,
      inReplyTo: row.inReplyTo || undefined,
      references: row.references ? JSON.parse(row.references) : undefined,
      syncedAt: row.syncedAt,
    };
  },

  async markAsRead(id: string, read: boolean): Promise<void> {
    const db = await getDb();
    await db.update(schema.messages)
      .set({ isRead: read ? 1 : 0 })
      .where(eq(schema.messages.id, id));
  },

  async update(id: string, updates: Partial<MailMessage>): Promise<void> {
    const db = await getDb();
    const updateData: any = {};
    
    if (updates.folderId !== undefined) {
      updateData.folderId = updates.folderId;
    }
    if (updates.isRead !== undefined) {
      updateData.isRead = updates.isRead ? 1 : 0;
    }
    if (updates.isStarred !== undefined) {
      updateData.isStarred = updates.isStarred ? 1 : 0;
    }
    if (updates.isImportant !== undefined) {
      updateData.isImportant = updates.isImportant ? 1 : 0;
    }
    if (updates.flags !== undefined) {
      updateData.flags = JSON.stringify(updates.flags);
    }
    
    if (Object.keys(updateData).length > 0) {
      await db.update(schema.messages)
        .set(updateData)
        .where(eq(schema.messages.id, id));
    }
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(schema.messages).where(eq(schema.messages.id, id));
  },

  async getThreadMessages(messageId: string): Promise<MailMessage[]> {
    const db = await getDb();
    
    // Prima ottieni il messaggio corrente per trovare il threadId
    const currentMessage = await this.get(messageId);
    if (!currentMessage || !currentMessage.threadId) {
      return [];
    }
    
    // Recupera tutti i messaggi dello stesso thread
    let results: any[];
    try {
      const selectQuery = db.select().from(schema.messages);
      
      if (selectQuery && typeof selectQuery.then === 'function') {
        results = await selectQuery;
      } else {
        results = selectQuery;
      }
      
      results = Array.isArray(results) ? results : [];
      
      // Filtra per threadId e ordina per data (crescente per mostrare il più vecchio prima)
      results = results.filter((row: any) => {
        const rowThreadId = row.threadId || (row.inReplyTo ? this.getThreadIdFromReply(row) : null);
        return rowThreadId === currentMessage.threadId;
      });
      
      // Ordina per data (crescente)
      results.sort((a: any, b: any) => {
        const dateA = a.date || 0;
        const dateB = b.date || 0;
        return dateA - dateB; // Crescente
      });
      
      // Escludi il messaggio corrente
      results = results.filter((row: any) => row.id !== messageId);
    } catch (error) {
      console.error('[Storage] Errore nel caricamento dello storico:', error);
      return [];
    }

    const messages: MailMessage[] = [];

    for (const row of results) {
      let attachments: any[] = [];
      try {
        const attachmentsQuery = db.select().from(schema.attachments);
        let allAttachments: any[];
        
        if (attachmentsQuery && typeof attachmentsQuery.then === 'function') {
          allAttachments = await attachmentsQuery;
        } else {
          allAttachments = attachmentsQuery;
        }
        
        allAttachments = Array.isArray(allAttachments) ? allAttachments : [];
        attachments = allAttachments.filter((a: any) => a.messageId === row.id);
      } catch (error) {
        attachments = [];
      }

      messages.push({
        id: row.id,
        accountId: row.accountId,
        folderId: row.folderId,
        uid: row.uid,
        messageId: row.messageId,
        subject: row.subject,
        from: {
          name: row.fromName || undefined,
          address: row.fromAddress,
        },
        to: JSON.parse(row.toAddresses || '[]'),
        cc: row.ccAddresses ? JSON.parse(row.ccAddresses) : undefined,
        bcc: row.bccAddresses ? JSON.parse(row.bccAddresses) : undefined,
        date: new Date(row.date),
        text: row.text || undefined,
        html: row.html || undefined,
        attachments: attachments.map(a => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
          contentId: a.contentId || undefined,
          content: a.content as Buffer,
        })),
        flags: JSON.parse(row.flags || '[]'),
        isRead: row.isRead === 1,
        isStarred: row.isStarred === 1,
        isImportant: row.isImportant === 1,
        threadId: row.threadId || undefined,
        inReplyTo: row.inReplyTo || undefined,
        references: row.references ? JSON.parse(row.references) : undefined,
        syncedAt: row.syncedAt,
      });
    }

    return messages;
  },

  getThreadIdFromReply(row: any): string | null {
    // Se il messaggio ha inReplyTo, cerca il messaggio originale per ottenere il threadId
    // Per semplicità, usiamo inReplyTo come threadId se non c'è threadId esplicito
    return row.inReplyTo || null;
  },
};

/**
 * Gestione impostazioni
 */
export const settingsStorage = {
  async get(): Promise<AppSettings> {
    const db = await getDb();
    const result = await db.select()
      .from(schema.settings)
      .where(eq(schema.settings.key, 'app_settings'))
      .limit(1);

    if (result.length === 0) {
      return {
        theme: 'dark',
        notifications: true,
        syncInterval: 5,
        autoSync: true,
      };
    }

    return JSON.parse(result[0].value);
  },

  async save(settings: AppSettings): Promise<void> {
    const db = await getDb();
    await db.insert(schema.settings).values({
      key: 'app_settings',
      value: JSON.stringify(settings),
    }).onConflictDoUpdate({
      target: schema.settings.key,
      set: {
        value: JSON.stringify(settings),
      },
    });
  },
};

/**
 * Crea dati di esempio per un nuovo account
 */
async function createSampleData(account: Account): Promise<void> {
  try {
    const db = await getDb();
    
    // Crea cartelle di esempio
    const folders = [
      { id: `${account.id}-inbox`, name: 'Inbox', path: 'INBOX', unreadCount: 3, totalCount: 5 },
      { id: `${account.id}-sent`, name: 'Sent', path: 'Sent', unreadCount: 0, totalCount: 2 },
      { id: `${account.id}-drafts`, name: 'Drafts', path: 'Drafts', unreadCount: 1, totalCount: 1 },
      { id: `${account.id}-archive`, name: 'Archive', path: 'Archive', unreadCount: 0, totalCount: 1 },
    ];
    
    for (const folder of folders) {
      try {
        const insertResult = db.insert(schema.folders).values({
          id: folder.id,
          accountId: account.id,
          name: folder.name,
          path: folder.path,
          unreadCount: folder.unreadCount,
          totalCount: folder.totalCount,
          syncAt: Date.now(),
        });
        
        if (insertResult.onConflictDoUpdate) {
          await insertResult.onConflictDoUpdate({
            target: schema.folders.id,
            set: {
              name: folder.name,
              unreadCount: folder.unreadCount,
              totalCount: folder.totalCount,
              syncAt: Date.now(),
            },
          }).set({
            name: folder.name,
            unreadCount: folder.unreadCount,
            totalCount: folder.totalCount,
            syncAt: Date.now(),
          });
        } else if (insertResult.then) {
          await insertResult;
        }
      } catch (error) {
        console.error(`[Storage] Errore nel salvataggio della cartella ${folder.name}:`, error);
      }
    }
    
    // Crea messaggi di esempio per la cartella inbox
    const inboxFolderId = `${account.id}-inbox`;
    
    // Thread ID per i messaggi collegati - "Leave of Absence" thread
    const leaveThreadId = `thread-${account.id}-leave-absence`;
    const leaveOriginalId = `msg-leave-original-${Date.now()}`;
    const leaveReply1Id = `msg-leave-reply1-${Date.now()}`;
    const leaveReply2Id = `msg-leave-reply2-${Date.now()}`;
    const leaveCurrentId = `msg-leave-current-${Date.now()}`;
    
    // Thread ID per "Project Update" thread
    const projectThreadId = `thread-${account.id}-project-update`;
    const projectOriginalId = `msg-project-original-${Date.now()}`;
    const projectReply1Id = `msg-project-reply1-${Date.now()}`;
    const projectReply2Id = `msg-project-reply2-${Date.now()}`;
    const projectCurrentId = `msg-project-current-${Date.now()}`;
    
    const sampleMessages = [
      // ===== THREAD "Leave of Absence" (con più risposte) =====
      // Messaggio originale (più vecchio)
      {
        id: `${account.id}-msg-leave-1`,
        accountId: account.id,
        folderId: inboxFolderId,
        uid: 1,
        messageId: leaveOriginalId,
        subject: 'Re: Project Update',
        fromName: 'David Lee',
        fromAddress: 'david.lee@company.com',
        toAddresses: JSON.stringify([{ name: account.displayName, address: account.email }]),
        ccAddresses: null,
        bccAddresses: null,
        date: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 giorni fa
        text: 'Sounds good, thanks for the update! I\'ve added my comments to the document.',
        html: '<p>Sounds good, thanks for the update!</p><p>I\'ve added my comments to the document.</p>',
        flags: JSON.stringify([]),
        isRead: 1,
        isStarred: 0,
        isImportant: 0,
        threadId: leaveThreadId,
        inReplyTo: null,
        references: null,
        syncedAt: Date.now(),
      },
      // Prima risposta
      {
        id: `${account.id}-msg-leave-2`,
        accountId: account.id,
        folderId: inboxFolderId,
        uid: 2,
        messageId: leaveReply1Id,
        subject: 'Leave of Absence',
        fromName: 'Sarah Miller',
        fromAddress: 'sarah.miller@company.com',
        toAddresses: JSON.stringify([{ name: 'Team', address: 'team@company.com' }]),
        ccAddresses: JSON.stringify([{ name: 'Management', address: 'management@company.com' }]),
        bccAddresses: null,
        date: Date.now() - 4 * 24 * 60 * 60 * 1000, // 4 giorni fa
        text: 'Hi Team,\n\nI\'m writing to inform you that I\'ll be taking a leave of absence from December 15th to January 5th. I\'ll be back in the office on January 6th.\n\nPlease let me know if you need anything from me before I leave.\n\nThanks,',
        html: '<p>Hi Team,</p><p>I\'m writing to inform you that I\'ll be taking a leave of absence from December 15th to January 5th. I\'ll be back in the office on January 6th.</p><p>Please let me know if you need anything from me before I leave.</p><p>Thanks,</p>',
        flags: JSON.stringify([]),
        isRead: 1,
        isStarred: 0,
        isImportant: 1,
        threadId: leaveThreadId,
        inReplyTo: leaveOriginalId,
        references: JSON.stringify([leaveOriginalId]),
        syncedAt: Date.now(),
      },
      // Seconda risposta
      {
        id: `${account.id}-msg-leave-3`,
        accountId: account.id,
        folderId: inboxFolderId,
        uid: 3,
        messageId: leaveReply2Id,
        subject: 'Leave of Absence',
        fromName: 'John Smith',
        fromAddress: 'john.smith@company.com',
        toAddresses: JSON.stringify([{ name: 'Sarah Miller', address: 'sarah.miller@company.com' }, { name: 'Team', address: 'team@company.com' }]),
        ccAddresses: null,
        bccAddresses: null,
        date: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 giorni fa
        text: 'Thanks for letting us know, Sarah! We\'ll make sure everything is covered while you\'re away. Enjoy your time off!',
        html: '<p>Thanks for letting us know, Sarah!</p><p>We\'ll make sure everything is covered while you\'re away. Enjoy your time off!</p>',
        flags: JSON.stringify([]),
        isRead: 1,
        isStarred: 0,
        isImportant: 0,
        threadId: leaveThreadId,
        inReplyTo: leaveReply1Id,
        references: JSON.stringify([leaveOriginalId, leaveReply1Id]),
        syncedAt: Date.now(),
      },
      // Messaggio corrente (più recente) - questo sarà quello visualizzato
      {
        id: `${account.id}-msg-leave-4`,
        accountId: account.id,
        folderId: inboxFolderId,
        uid: 4,
        messageId: leaveCurrentId,
        subject: 'Leave of Absence',
        fromName: 'Sarah Miller',
        fromAddress: 'sarah.miller@company.com',
        toAddresses: JSON.stringify([{ name: 'John Smith', address: 'john.smith@company.com' }, { name: 'Team', address: 'team@company.com' }]),
        ccAddresses: null,
        bccAddresses: null,
        date: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 giorni fa
        text: 'Thank you so much, John! I really appreciate it. I\'ll send you a handover document before I leave.',
        html: '<p>Thank you so much, John!</p><p>I really appreciate it. I\'ll send you a handover document before I leave.</p>',
        flags: JSON.stringify(['\\Flagged']),
        isRead: 0,
        isStarred: 0,
        isImportant: 1,
        threadId: leaveThreadId,
        inReplyTo: leaveReply2Id,
        references: JSON.stringify([leaveOriginalId, leaveReply1Id, leaveReply2Id]),
        syncedAt: Date.now(),
      },
      
      // ===== THREAD "Project Update" (con più risposte) =====
      // Messaggio originale del thread (più vecchio)
      {
        id: `${account.id}-msg-project-1`,
        accountId: account.id,
        folderId: inboxFolderId,
        uid: 5,
        messageId: projectOriginalId,
        subject: 'Re: Project Update',
        fromName: 'David Lee',
        fromAddress: 'david.lee@company.com',
        toAddresses: JSON.stringify([{ name: account.displayName, address: account.email }]),
        ccAddresses: null,
        bccAddresses: null,
        date: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 giorni fa
        text: 'Ciao, ecco un aggiornamento sul progetto. Abbiamo completato la fase 1 e stiamo procedendo con la fase 2.',
        html: '<p>Ciao,</p><p>Ecco un aggiornamento sul progetto. Abbiamo completato la fase 1 e stiamo procedendo con la fase 2.</p>',
        flags: JSON.stringify([]),
        isRead: 1,
        isStarred: 0,
        isImportant: 0,
        threadId: projectThreadId,
        inReplyTo: null,
        references: null,
        syncedAt: Date.now(),
      },
      // Messaggio di risposta (medio)
      {
        id: `${account.id}-msg-project-2`,
        accountId: account.id,
        folderId: inboxFolderId,
        uid: 6,
        messageId: projectReply1Id,
        subject: 'Re: Project Update',
        fromName: 'Sarah Miller',
        fromAddress: 'sarah.miller@company.com',
        toAddresses: JSON.stringify([{ name: 'David Lee', address: 'david.lee@company.com' }, { name: account.displayName, address: account.email }]),
        ccAddresses: null,
        bccAddresses: null,
        date: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 giorni fa
        text: 'Grazie per l\'aggiornamento! Possiamo programmare una riunione per discutere i dettagli della fase 2?',
        html: '<p>Grazie per l\'aggiornamento!</p><p>Possiamo programmare una riunione per discutere i dettagli della fase 2?</p>',
        flags: JSON.stringify([]),
        isRead: 1,
        isStarred: 0,
        isImportant: 0,
        threadId: projectThreadId,
        inReplyTo: projectOriginalId,
        references: JSON.stringify([projectOriginalId]),
        syncedAt: Date.now(),
      },
      // Seconda risposta
      {
        id: `${account.id}-msg-project-3`,
        accountId: account.id,
        folderId: inboxFolderId,
        uid: 7,
        messageId: projectReply2Id,
        subject: 'Re: Project Update',
        fromName: 'Michael Chen',
        fromAddress: 'michael.chen@company.com',
        toAddresses: JSON.stringify([{ name: 'David Lee', address: 'david.lee@company.com' }, { name: 'Sarah Miller', address: 'sarah.miller@company.com' }, { name: account.displayName, address: account.email }]),
        ccAddresses: null,
        bccAddresses: null,
        date: Date.now() - 1.5 * 24 * 60 * 60 * 1000, // 1.5 giorni fa
        text: 'Ottima idea! Sono disponibile questa settimana. Quale giorno preferite?',
        html: '<p>Ottima idea!</p><p>Sono disponibile questa settimana. Quale giorno preferite?</p>',
        flags: JSON.stringify([]),
        isRead: 1,
        isStarred: 0,
        isImportant: 0,
        threadId: projectThreadId,
        inReplyTo: projectReply1Id,
        references: JSON.stringify([projectOriginalId, projectReply1Id]),
        syncedAt: Date.now(),
      },
      // Messaggio corrente (più recente) - questo sarà quello visualizzato
      {
        id: `${account.id}-msg-project-4`,
        accountId: account.id,
        folderId: inboxFolderId,
        uid: 8,
        messageId: projectCurrentId,
        subject: 'Re: Project Update',
        fromName: 'David Lee',
        fromAddress: 'david.lee@company.com',
        toAddresses: JSON.stringify([{ name: 'Sarah Miller', address: 'sarah.miller@company.com' }, { name: 'Michael Chen', address: 'michael.chen@company.com' }, { name: account.displayName, address: account.email }]),
        ccAddresses: null,
        bccAddresses: null,
        date: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 giorno fa
        text: 'Perfetto! Ho preparato una presentazione. Possiamo incontrarci domani alle 14:00?',
        html: '<p>Perfetto!</p><p>Ho preparato una presentazione. Possiamo incontrarci domani alle 14:00?</p>',
        flags: JSON.stringify([]),
        isRead: 0,
        isStarred: 0,
        isImportant: 1,
        threadId: projectThreadId,
        inReplyTo: projectReply2Id,
        references: JSON.stringify([projectOriginalId, projectReply1Id, projectReply2Id]),
        syncedAt: Date.now(),
      },
      // Altri messaggi non collegati
      {
        id: `${account.id}-msg-1`,
        accountId: account.id,
        folderId: inboxFolderId,
        uid: 4,
        messageId: `msg-1-${Date.now()}`,
        subject: 'Benvenuto nella tua nuova email client!',
        fromName: 'Team Email Client',
        fromAddress: 'noreply@emailclient.com',
        toAddresses: JSON.stringify([{ name: account.displayName, address: account.email }]),
        ccAddresses: null,
        bccAddresses: null,
        date: Date.now() - 2 * 60 * 60 * 1000, // 2 ore fa
        text: 'Benvenuto! Questo è un messaggio di esempio. La sincronizzazione delle email verrà implementata presto.',
        html: '<p>Benvenuto! Questo è un messaggio di esempio. La sincronizzazione delle email verrà implementata presto.</p>',
        flags: JSON.stringify([]),
        isRead: 0,
        isStarred: 0,
        isImportant: 0,
        threadId: null,
        inReplyTo: null,
        references: null,
        syncedAt: Date.now(),
      },
      {
        id: `${account.id}-msg-2`,
        accountId: account.id,
        folderId: inboxFolderId,
        uid: 5,
        messageId: `msg-2-${Date.now()}`,
        subject: 'Come iniziare',
        fromName: 'Support Team',
        fromAddress: 'support@emailclient.com',
        toAddresses: JSON.stringify([{ name: account.displayName, address: account.email }]),
        ccAddresses: null,
        bccAddresses: null,
        date: Date.now() - 5 * 60 * 60 * 1000, // 5 ore fa
        text: 'Ecco alcuni suggerimenti per iniziare:\n\n1. Collega il tuo account email\n2. Sincronizza le tue email\n3. Inizia a gestire i tuoi messaggi',
        html: '<p>Ecco alcuni suggerimenti per iniziare:</p><ul><li>Collega il tuo account email</li><li>Sincronizza le tue email</li><li>Inizia a gestire i tuoi messaggi</li></ul>',
        flags: JSON.stringify([]),
        isRead: 0,
        isStarred: 1,
        isImportant: 0,
        threadId: null,
        inReplyTo: null,
        references: null,
        syncedAt: Date.now(),
      },
    ];
    
    for (const msg of sampleMessages) {
      try {
        const insertResult = db.insert(schema.messages).values(msg);
        
        if (insertResult.onConflictDoUpdate) {
          await insertResult.onConflictDoUpdate({
            target: schema.messages.id,
            set: {
              folderId: msg.folderId,
              flags: msg.flags,
              isRead: msg.isRead,
              isStarred: msg.isStarred,
              isImportant: msg.isImportant,
              syncedAt: msg.syncedAt,
            },
          }).set({
            folderId: msg.folderId,
            flags: msg.flags,
            isRead: msg.isRead,
            isStarred: msg.isStarred,
            isImportant: msg.isImportant,
            syncedAt: msg.syncedAt,
          });
        } else if (insertResult.then) {
          await insertResult;
        }
      } catch (error) {
        console.error(`[Storage] Errore nel salvataggio del messaggio ${msg.id}:`, error);
      }
    }
    
    console.log('[Storage] Dati di esempio creati per account:', account.id);
  } catch (error) {
    console.error('[Storage] Errore nella creazione dei dati di esempio:', error);
    // Non bloccare il salvataggio dell'account se la creazione dei dati di esempio fallisce
  }
}

