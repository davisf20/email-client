/**
 * Client SMTP per l'invio delle email
 * Nota: nodemailer è una libreria Node.js e non può essere eseguita nel browser.
 * Questa logica dovrebbe essere spostata in comandi Rust di Tauri.
 */

import type { Account, ComposeMessage } from '../types';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    type: 'OAuth2';
    user: string;
    accessToken: string;
  };
}

/**
 * Ottiene la configurazione SMTP per un provider
 * Nota: Non utilizzato attualmente, mantenuto per riferimento futuro
 */
// @ts-ignore - Funzione non utilizzata ma mantenuta per riferimento
const _getSmtpConfig = (_provider: 'gmail' | 'outlook', _email: string, _accessToken: string): SmtpConfig => {
  const provider = _provider;
  const email = _email;
  const accessToken = _accessToken;
  if (provider === 'gmail') {
    return {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: email,
        accessToken,
      },
    };
  }

  if (provider === 'outlook') {
    return {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        type: 'OAuth2',
        user: email,
        accessToken,
      },
    };
  }

  throw new Error(`Provider non supportato: ${provider}`);
};

/**
 * Invia un'email
 * Usa i comandi Tauri se disponibili, altrimenti errore
 */
export const sendEmail = async (
  account: Account,
  message: ComposeMessage
): Promise<void> => {
  // Prova a usare i comandi Tauri se disponibili
  try {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      const { sendEmailTauri } = await import('./tauri-smtp');
      return await sendEmailTauri(account, message);
    }
  } catch (error) {
    console.error('[SMTP] Errore nell\'invio tramite Tauri:', error);
    throw error;
  }
  
  // Se non siamo in Tauri, errore
  throw new Error('sendEmail disponibile solo in ambiente Tauri. Implementare comando Rust.');
};
