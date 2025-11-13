/**
 * Wrapper TypeScript per i comandi Tauri IMAP
 */

import { invoke } from '@tauri-apps/api/core';
import type { Account, MailFolder, MailMessage } from '../types';
import { getAccountWithValidToken } from '../auth/token-refresh';

/**
 * Sincronizza le cartelle di un account usando il comando Tauri
 */
export const syncFoldersTauri = async (account: Account): Promise<MailFolder[]> => {
  // Assicura che il token sia valido
  const accountWithValidToken = await getAccountWithValidToken(account.id);
  
  try {
    console.log('[IMAP Tauri] Chiamata sync_folders per account:', accountWithValidToken.email);
    
    // Verifica che invoke sia disponibile e funzionante
    const { invoke } = await import('@tauri-apps/api/core');
    if (!invoke || typeof invoke !== 'function') {
      throw new Error('invoke non disponibile - non siamo in ambiente Tauri');
    }
    
    const folders = await invoke<MailFolder[]>('sync_folders', {
      accountId: accountWithValidToken.id,
      email: accountWithValidToken.email,
      provider: accountWithValidToken.provider,
      accessToken: accountWithValidToken.tokens.accessToken,
    });
    
    console.log('[IMAP Tauri] Risposta sync_folders:', folders.length, 'cartelle');
    return folders;
  } catch (error) {
    console.error('[IMAP Tauri] Errore nella sincronizzazione delle cartelle:', error);
    throw error;
  }
};

/**
 * Sincronizza i messaggi di una cartella usando il comando Tauri
 */
export const syncMessagesTauri = async (
  account: Account,
  folderPath: string,
  since?: Date
): Promise<MailMessage[]> => {
  // Assicura che il token sia valido
  const accountWithValidToken = await getAccountWithValidToken(account.id);
  
  try {
    console.log('[IMAP Tauri] Chiamata sync_messages per cartella:', folderPath);
    
    // Verifica che invoke sia disponibile e funzionante
    const { invoke: invokeFn } = await import('@tauri-apps/api/core');
    if (!invokeFn || typeof invokeFn !== 'function') {
      throw new Error('invoke non disponibile - non siamo in ambiente Tauri');
    }
    
    const messages = await invokeFn<MailMessage[]>('sync_messages', {
      accountId: accountWithValidToken.id,
      folderId: '', // Sarà determinato dal frontend
      folderPath,
      email: accountWithValidToken.email,
      provider: accountWithValidToken.provider,
      accessToken: accountWithValidToken.tokens.accessToken,
      since: since ? since.getTime() : null,
    });
    
    console.log('[IMAP Tauri] Risposta sync_messages:', messages.length, 'messaggi');
    return messages;
  } catch (error) {
    console.error('[IMAP Tauri] Errore nella sincronizzazione dei messaggi:', error);
    throw error;
  }
};

/**
 * Marca un messaggio come letto/non letto usando il comando Tauri
 */
export const markMessageReadTauri = async (
  account: Account,
  folderPath: string,
  uid: number,
  read: boolean
): Promise<void> => {
  // Assicura che il token sia valido
  const accountWithValidToken = await getAccountWithValidToken(account.id);
  
  try {
    await invoke('mark_message_read', {
      accountId: accountWithValidToken.id,
      folderPath,
      uid,
      read,
      accessToken: accountWithValidToken.tokens.accessToken,
    });
  } catch (error) {
    console.error('[IMAP Tauri] Errore nel marcare il messaggio come letto:', error);
    throw error;
  }
};

/**
 * Sposta un messaggio usando il comando Tauri
 */
export const moveMessageTauri = async (
  account: Account,
  folderPath: string,
  uid: number,
  targetFolder: string
): Promise<void> => {
  // Assicura che il token sia valido
  const accountWithValidToken = await getAccountWithValidToken(account.id);
  
  try {
    await invoke('move_message', {
      accountId: accountWithValidToken.id,
      folderPath,
      uid,
      targetFolder,
      email: accountWithValidToken.email,
      provider: accountWithValidToken.provider,
      accessToken: accountWithValidToken.tokens.accessToken,
    });
  } catch (error) {
    console.error('[IMAP Tauri] Errore nello spostamento del messaggio:', error);
    throw error;
  }
};

/**
 * Elimina un messaggio usando il comando Tauri
 */
export const deleteMessageTauri = async (
  account: Account,
  folderPath: string,
  uid: number
): Promise<void> => {
  // Assicura che il token sia valido
  const accountWithValidToken = await getAccountWithValidToken(account.id);
  
  try {
    await invoke('delete_message', {
      accountId: accountWithValidToken.id,
      folderPath,
      uid,
      email: accountWithValidToken.email,
      provider: accountWithValidToken.provider,
      accessToken: accountWithValidToken.tokens.accessToken,
    });
  } catch (error) {
    console.error('[IMAP Tauri] Errore nell\'eliminazione del messaggio:', error);
    throw error;
  }
};

