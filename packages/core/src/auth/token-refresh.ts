/**
 * Gestione del refresh automatico dei token OAuth2
 */

import type { Account } from '../types';
import { refreshAccessToken } from './oauth';
import { accountStorage } from '../storage/storage';

/**
 * Assicura che il token di accesso sia valido, refreshandolo se necessario
 * Refresh automatico se il token scade tra meno di 5 minuti
 */
export const ensureValidToken = async (account: Account): Promise<string> => {
  const now = Date.now();
  const expiresAt = account.tokens.expiresAt;
  const timeUntilExpiry = expiresAt - now;
  
  console.log(`[Token Refresh] Controllo token per account ${account.id}:`, {
    expiresAt: new Date(expiresAt).toISOString(),
    now: new Date(now).toISOString(),
    timeUntilExpiry: Math.round(timeUntilExpiry / 1000),
    isExpired: timeUntilExpiry < 0,
  });
  
  // Refresh se scade tra meno di 5 minuti (300000 ms) o se è già scaduto
  const REFRESH_THRESHOLD = 5 * 60 * 1000;
  
  if (timeUntilExpiry < REFRESH_THRESHOLD) {
    if (!account.tokens.refreshToken) {
      console.error('[Token Refresh] Nessun refresh token disponibile!');
      throw new Error('Token scaduto e nessun refresh token disponibile. È necessario rifare il login.');
    }
    
    console.log(`[Token Refresh] Token scade tra ${Math.round(timeUntilExpiry / 1000)}s, refresh in corso...`);
    
    try {
      const newTokens = await refreshAccessToken(account.provider, account.tokens.refreshToken);
      
      // Aggiorna i token nello storage
      await accountStorage.updateTokens(account.id, newTokens);
      
      console.log(`[Token Refresh] Token aggiornato con successo, nuovo expiry: ${new Date(newTokens.expiresAt).toISOString()}`);
      
      return newTokens.accessToken;
    } catch (error) {
      console.error('[Token Refresh] Errore nel refresh del token:', error);
      // Se il refresh fallisce, prova comunque con il token corrente
      // L'errore verrà gestito dalla chiamata API successiva
      throw new Error(`Impossibile aggiornare il token: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  }
  
  console.log(`[Token Refresh] Token ancora valido per ${Math.round(timeUntilExpiry / 1000)}s`);
  return account.tokens.accessToken;
};

/**
 * Ottiene un account con token valido
 * Se il token è scaduto o sta per scadere, lo refresha automaticamente
 */
export const getAccountWithValidToken = async (accountId: string): Promise<Account> => {
  const account = await accountStorage.get(accountId);
  
  if (!account) {
    throw new Error(`Account ${accountId} non trovato`);
  }
  
  // Assicura che il token sia valido
  await ensureValidToken(account);
  
  // Ricarica l'account per ottenere i token aggiornati
  const updatedAccount = await accountStorage.get(accountId);
  
  if (!updatedAccount) {
    throw new Error(`Account ${accountId} non trovato dopo il refresh`);
  }
  
  return updatedAccount;
};

