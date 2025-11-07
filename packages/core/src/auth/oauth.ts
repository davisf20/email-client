/**
 * Gestione OAuth2 per Gmail e Outlook
 */

import type { AccountProvider, OAuthTokens } from '../types';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scopes: string[];
}

// Helper per ottenere variabili d'ambiente
// In Vite, le variabili d'ambiente devono avere il prefisso VITE_ e sono accessibili tramite import.meta.env
const getEnv = (key: string): string => {
  // Usa import.meta.env (disponibile in Vite/browser)
  // @ts-ignore - import.meta.env è disponibile in Vite
  const viteEnv = (import.meta as any)?.env;
  if (viteEnv) {
    const value = viteEnv[`VITE_${key}`] || '';
    // Debug: log solo in sviluppo
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log(`[OAuth] getEnv(${key}):`, value ? 'Found' : 'Not found');
    }
    return value;
  }
  return '';
};

const PROVIDER_CONFIGS: Record<AccountProvider, OAuthConfig> = {
  gmail: {
    clientId: getEnv('GOOGLE_CLIENT_ID'),
    clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    redirectUri: 'http://localhost:1420',
    scopes: [
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  },
  outlook: {
    clientId: getEnv('OUTLOOK_CLIENT_ID'),
    clientSecret: getEnv('OUTLOOK_CLIENT_SECRET'),
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    redirectUri: 'http://localhost:1420',
    scopes: [
      'https://outlook.office.com/IMAP.AccessAsUser.All',
      'https://outlook.office.com/SMTP.Send',
      'https://graph.microsoft.com/User.Read',
    ],
  },
};

/**
 * Avvia il flusso OAuth2 per un provider
 * Nota: In Tauri v2, OAuth viene gestito aprendo una finestra del browser
 * e intercettando il redirect. Per ora usiamo un approccio semplificato.
 */
export const startOAuth2 = async (provider: AccountProvider): Promise<OAuthTokens> => {
  const config = PROVIDER_CONFIGS[provider];
  
  // Verifica che le credenziali siano configurate
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      `Credenziali OAuth2 non configurate per ${provider}. ` +
      `Assicurati di aver impostato VITE_${provider === 'gmail' ? 'GOOGLE' : 'OUTLOOK'}_CLIENT_ID e VITE_${provider === 'gmail' ? 'GOOGLE' : 'OUTLOOK'}_CLIENT_SECRET nel file .env`
    );
  }
  
  if (typeof window !== 'undefined') {
    try {
      // Verifica se siamo in Tauri
      const isTauri = (window as any).__TAURI__;
      
      if (isTauri) {
        // In Tauri v2, apriamo una finestra del browser per OAuth
        // Import dinamico usando una stringa che Vite non può risolvere staticamente
        // @ts-ignore - import dinamico opzionale
        const shellModule = await new Function('return import("@tauri-apps/api/shell")')().catch(() => null);
        
        if (!shellModule) {
          throw new Error('Modulo shell di Tauri non disponibile');
        }
        
        const { open } = shellModule;
        
        // Costruisci l'URL di autorizzazione
        const params = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          response_type: 'code',
          scope: config.scopes.join(' '),
          access_type: 'offline',
          prompt: 'consent',
        });
        
        const authUrl = `${config.authorizationUrl}?${params.toString()}`;
        
        // Apri il browser per l'autorizzazione
        await open(authUrl);
        
        // TODO: Implementare l'intercettazione del redirect e lo scambio del codice per il token
        // Per ora, questo è un placeholder che richiede implementazione completa
        // In produzione, dovresti usare un server locale o un deep link per intercettare il redirect
        
        throw new Error('OAuth2 flow non completamente implementato. Implementare intercettazione redirect.');
      } else {
        // In ambiente browser normale, apriamo in una nuova finestra
        const params = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          response_type: 'code',
          scope: config.scopes.join(' '),
          access_type: 'offline',
          prompt: 'consent',
        });
        
        const authUrl = `${config.authorizationUrl}?${params.toString()}`;
        window.open(authUrl, 'oauth', 'width=600,height=700');
        
        throw new Error('OAuth2 flow non completamente implementato. Implementare intercettazione redirect.');
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('non disponibile') || error.message.includes('non configurate'))) {
        throw error;
      }
      throw new Error(`Errore durante l'apertura del browser OAuth: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  }

  throw new Error('OAuth2 non disponibile in questo ambiente');
};

/**
 * Aggiorna un token di accesso usando il refresh token
 */
export const refreshAccessToken = async (
  provider: AccountProvider,
  refreshToken: string
): Promise<OAuthTokens> => {
  const config = PROVIDER_CONFIGS[provider];
  
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Errore nel refresh del token: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    tokenType: data.token_type || 'Bearer',
  };
};

/**
 * Ottiene le informazioni dell'utente dal provider
 */
export const getUserInfo = async (
  provider: AccountProvider,
  accessToken: string
): Promise<{ email: string; name: string }> => {
  if (provider === 'gmail') {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Errore nel recupero delle informazioni utente');
    }

    const data = await response.json();
    return {
      email: data.email,
      name: data.name || data.email,
    };
  }

  if (provider === 'outlook') {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Errore nel recupero delle informazioni utente');
    }

    const data = await response.json();
    return {
      email: data.mail || data.userPrincipalName,
      name: data.displayName || data.mail || data.userPrincipalName,
    };
  }

  throw new Error(`Provider non supportato: ${provider}`);
};

