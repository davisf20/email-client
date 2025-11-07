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
 */
const getSmtpConfig = (provider: 'gmail' | 'outlook', email: string, accessToken: string): SmtpConfig => {
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
 * Nota: Questa funzione richiede nodemailer che è disponibile solo in Node.js.
 * In Tauri, questa logica dovrebbe essere implementata come comando Rust.
 */
export const sendEmail = async (
  account: Account,
  message: ComposeMessage
): Promise<void> => {
  // TODO: Implementare come comando Tauri Rust
  console.warn('sendEmail non disponibile nel browser. Implementare come comando Tauri.');
  throw new Error('sendEmail non disponibile nel browser. Implementare come comando Tauri.');
};
