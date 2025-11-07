/**
 * Storage manager per account, messaggi e impostazioni
 */

import { eq, and, desc } from 'drizzle-orm';
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
    await db.delete(schema.accounts).where(eq(schema.accounts.id, id));
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

    return results.map(row => ({
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
    const results = await db.select()
      .from(schema.messages)
      .where(eq(schema.messages.folderId, folderId))
      .orderBy(desc(schema.messages.date))
      .limit(limit)
      .offset(offset);

    const messages: MailMessage[] = [];

    for (const row of results) {
      const attachments = await db.select()
        .from(schema.attachments)
        .where(eq(schema.attachments.messageId, row.id));

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
        to: JSON.parse(row.toAddresses),
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
        flags: JSON.parse(row.flags),
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
      attachments: attachments.map(a => ({
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

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(schema.messages).where(eq(schema.messages.id, id));
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

