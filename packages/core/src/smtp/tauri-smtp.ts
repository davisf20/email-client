/**
 * Wrapper TypeScript per i comandi Tauri SMTP
 */

import { invoke } from '@tauri-apps/api/core';
import type { Account, ComposeMessage } from '../types';
import { getAccountWithValidToken } from '../auth/token-refresh';

/**
 * Invia un'email usando il comando Tauri SMTP
 */
export const sendEmailTauri = async (account: Account, message: ComposeMessage): Promise<void> => {
  // Assicura che il token sia valido
  const accountWithValidToken = await getAccountWithValidToken(account.id);

  try {
    await invoke('send_email', {
      accountId: accountWithValidToken.id,
      email: accountWithValidToken.email,
      provider: accountWithValidToken.provider,
      accessToken: accountWithValidToken.tokens.accessToken,
      message: {
        to: message.to.map((addr: string | { address: string }) => (typeof addr === 'string' ? addr : addr.address)),
        cc: message.cc?.map((addr: string | { address: string }) => (typeof addr === 'string' ? addr : addr.address)),
        bcc: message.bcc?.map((addr: string | { address: string }) => (typeof addr === 'string' ? addr : addr.address)),
        subject: message.subject,
        bodyHtml: message.html,
        bodyText: message.text,
        attachments: message.attachments?.map((att) => {
          // Se è un File, leggerlo come ArrayBuffer
          if (att instanceof File) {
            // Per ora, non gestiamo File direttamente
            // Dovrebbe essere convertito in ArrayBuffer prima
            throw new Error('File attachments must be converted to ArrayBuffer first');
          }
          // Se è già un oggetto con content
          return {
            filename: att.filename || 'attachment',
            contentType: att.contentType || 'application/octet-stream',
            content: Array.from(new Uint8Array(att.content)), // Converti Buffer/Uint8Array in Vec<u8>
          };
        }),
      },
    });
  } catch (error) {
    console.error("[SMTP Tauri] Errore nell'invio dell'email:", error);
    throw error;
  }
};
