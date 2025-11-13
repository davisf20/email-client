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
  try {
    // Prova diversi modi per accedere alle variabili d'ambiente
    // @ts-ignore - import.meta.env è disponibile in Vite
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
      const viteEnv = (import.meta as any).env;
      const value = viteEnv[`VITE_${key}`] || '';
      if (value) return value;
    }

    // Fallback: prova a leggere da window.__VITE_ENV__ se disponibile
    if (typeof window !== 'undefined' && (window as any).__VITE_ENV__) {
      const value = (window as any).__VITE_ENV__[`VITE_${key}`] || '';
      if (value) return value;
    }

    // Fallback: prova a leggere direttamente da process.env (se disponibile in sviluppo)
    if (typeof process !== 'undefined' && process.env) {
      const value = process.env[`VITE_${key}`] || '';
      if (value) return value;
    }
  } catch (error) {
    console.warn("[OAuth] Errore nel leggere variabili d'ambiente:", error);
  }

  return '';
};

// Funzione per ottenere la configurazione di un provider (legge le variabili dinamicamente)
const getProviderConfig = (provider: AccountProvider): OAuthConfig => {
  if (provider === 'gmail') {
    return {
      clientId: getEnv('GOOGLE_CLIENT_ID'),
      clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      redirectUri: 'http://localhost:1420/oauth/callback',
      scopes: [
        'https://mail.google.com/',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    };
  }

  if (provider === 'outlook') {
    return {
      clientId: getEnv('OUTLOOK_CLIENT_ID'),
      clientSecret: getEnv('OUTLOOK_CLIENT_SECRET'),
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      redirectUri: 'http://localhost:1420/oauth/callback',
      scopes: [
        'https://outlook.office.com/IMAP.AccessAsUser.All',
        'https://outlook.office.com/SMTP.Send',
        'https://graph.microsoft.com/User.Read',
      ],
    };
  }

  throw new Error(`Provider non supportato: ${provider}`);
};

/**
 * Ottiene il redirect URI OAuth2 per un provider
 */
export const getOAuthRedirectUri = (provider: AccountProvider): string => {
  const config = getProviderConfig(provider);
  return config.redirectUri;
};

/**
 * Ottiene l'URL di autorizzazione OAuth2 per un provider
 */
export const getOAuthUrl = (provider: AccountProvider): string => {
  const config = getProviderConfig(provider);
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${config.authorizationUrl}?${params.toString()}`;
};

/**
 * Scambia un codice OAuth con i token
 */
export const exchangeOAuthCode = async (
  provider: AccountProvider,
  code: string
): Promise<OAuthTokens> => {
  const config = getProviderConfig(provider);
  return exchangeCodeForTokens(provider, config, code);
};

/**
 * Avvia il flusso OAuth2 per un provider
 * Nota: In Tauri v2, OAuth viene gestito aprendo una finestra del browser
 * e intercettando il redirect. Per ora usiamo un approccio semplificato.
 * @deprecated Usa getOAuthUrl e exchangeOAuthCode invece per un controllo migliore
 */
export const startOAuth2 = async (provider: AccountProvider): Promise<OAuthTokens> => {
  // Leggi la configurazione dinamicamente per assicurarti che le variabili d'ambiente siano caricate
  const config = getProviderConfig(provider);

  // Debug: verifica le variabili d'ambiente
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log('[OAuth Debug]', {
      provider,
      clientId: config.clientId ? `${config.clientId.substring(0, 20)}...` : 'NOT FOUND',
      clientSecret: config.clientSecret ? 'Found' : 'NOT FOUND',
      redirectUri: config.redirectUri,
      env: (import.meta as any)?.env ? 'Available' : 'Not available',
    });
  }

  // Verifica che le credenziali siano configurate
  if (!config.clientId || !config.clientSecret) {
    const envKey = provider === 'gmail' ? 'GOOGLE' : 'OUTLOOK';
    throw new Error(
      `Credenziali OAuth2 non configurate per ${provider}. ` +
        `Assicurati di aver impostato VITE_${envKey}_CLIENT_ID e VITE_${envKey}_CLIENT_SECRET nel file .env nella root del progetto. ` +
        `Dopo aver aggiunto le variabili, riavvia il server di sviluppo.`
    );
  }

  if (typeof window !== 'undefined') {
    try {
      // Verifica se siamo in Tauri
      const isTauri = typeof window !== 'undefined' && 
                      ((window as any).__TAURI__ !== undefined || 
                       (window as any).__TAURI_INTERNALS__ !== undefined);

      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
      });

      const authUrl = `${config.authorizationUrl}?${params.toString()}`;
      
      // In Tauri, usa shell.open per aprire il browser di sistema
      if (isTauri) {
        try {
          console.log('[OAuth] Tauri rilevato, uso shell.open per aprire il browser');
          console.log('[OAuth] URL di autorizzazione:', authUrl);
          
          const shellModule = await new Function('return import("@tauri-apps/api/shell")')();
          await shellModule.open(authUrl);
          console.log('[OAuth] Browser aperto con successo');
          
          // Chiedi all'utente di incollare l'URL dopo il login
          return new Promise<OAuthTokens>((resolve, reject) => {
            // Aspetta un momento prima di mostrare il prompt per dare tempo al browser di aprire
            setTimeout(() => {
              const code = prompt(
                'Completa il login nel browser.\n\n' +
                'Dopo il login, verrai reindirizzato a una pagina.\n' +
                'Copia l\'intero URL dalla barra degli indirizzi del browser e incollalo qui:'
              );
              
              if (!code) {
                reject(new Error('Login annullato'));
                return;
              }
              
              // Estrai il codice dall'URL
              try {
                const url = new URL(code);
                const authCode = url.searchParams.get('code');
                if (!authCode) {
                  reject(new Error('Codice non trovato nell\'URL fornito. Assicurati di copiare l\'URL completo dalla barra degli indirizzi.'));
                  return;
                }
                
                console.log('[OAuth] Codice estratto dall\'URL, scambio con token...');
                // Scambia il codice con i token
                exchangeCodeForTokens(provider, config, authCode)
                  .then(resolve)
                  .catch(reject);
              } catch (error) {
                reject(new Error(`Errore nel parsing dell'URL: ${error instanceof Error ? error.message : 'Errore sconosciuto'}. Assicurati di copiare l'URL completo.`));
              }
            }, 1000);
          });
        } catch (error) {
          console.error('[OAuth] Errore nell\'uso di shell.open:', error);
          throw new Error(`Errore nell'apertura del browser OAuth: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
        }
      }
      
      // In ambiente browser normale (o fallback da Tauri), usa window.open
      const oauthWindow = window.open(authUrl, 'oauth', 'width=600,height=700');
      
      if (!oauthWindow) {
        throw new Error('Impossibile aprire la finestra OAuth. Verifica che i popup non siano bloccati.');
      }

      // Crea una promessa per intercettare il codice
      return new Promise<OAuthTokens>((resolve, reject) => {
          let hasReceivedMessage = false;
          
          // Listener per intercettare i messaggi dalla finestra OAuth
          const handleMessage = (event: MessageEvent) => {
            console.log('[OAuth] Messaggio ricevuto:', event.data);
            
            // Verifica l'origine per sicurezza (in produzione, usa l'origine corretta)
            if (event.data && event.data.type === 'oauth-code') {
              hasReceivedMessage = true;
              clearInterval(checkClosed);
              window.removeEventListener('message', handleMessage);
              
              console.log('[OAuth] Codice ricevuto, scambio con token...');
              
              // Scambia il codice con i token
              exchangeCodeForTokens(provider, config, event.data.code)
                .then((tokens) => {
                  console.log('[OAuth] Token ottenuti con successo');
                  try {
                    if (!oauthWindow.closed) {
                      oauthWindow.close();
                    }
                  } catch (error) {
                    // Ignora errori di Cross-Origin-Opener-Policy
                  }
                  resolve(tokens);
                })
                .catch((err) => {
                  console.error('[OAuth] Errore nello scambio del codice:', err);
                  try {
                    if (!oauthWindow.closed) {
                      oauthWindow.close();
                    }
                  } catch (error) {
                    // Ignora errori di Cross-Origin-Opener-Policy
                  }
                  reject(err);
                });
            } else if (event.data && event.data.type === 'oauth-error') {
              hasReceivedMessage = true;
              clearInterval(checkClosed);
              window.removeEventListener('message', handleMessage);
              if (!oauthWindow.closed) {
                oauthWindow.close();
              }
              reject(new Error(`Errore OAuth: ${event.data.error}`));
            }
          };

          window.addEventListener('message', handleMessage);

          // Verifica se la finestra è stata chiusa manualmente
          // Aspetta un po' prima di controllare per dare tempo al redirect
          const checkClosed = setInterval(() => {
            try {
              // Cross-Origin-Opener-Policy può bloccare window.closed, quindi gestiamo l'errore
              if (oauthWindow.closed && !hasReceivedMessage) {
                clearInterval(checkClosed);
                window.removeEventListener('message', handleMessage);
                reject(new Error('Finestra OAuth chiusa. Assicurati che il redirect URI sia configurato correttamente in Google Cloud Console: http://localhost:1420/oauth/callback'));
              }
            } catch (error) {
              // Ignora errori di Cross-Origin-Opener-Policy
              // Il messaggio postMessage gestirà comunque il callback
            }
          }, 1000);

          // Timeout dopo 5 minuti
          setTimeout(() => {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            if (!oauthWindow.closed) {
              oauthWindow.close();
            }
            reject(new Error('Timeout durante l\'autorizzazione OAuth'));
          }, 5 * 60 * 1000);
        });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('non disponibile') || error.message.includes('non configurate'))
      ) {
        throw error;
      }
      throw new Error(
        `Errore durante l'apertura del browser OAuth: ${
          error instanceof Error ? error.message : 'Errore sconosciuto'
        }`
      );
    }
  }

  throw new Error('OAuth2 non disponibile in questo ambiente');
};

/**
 * Scambia il codice di autorizzazione con i token OAuth
 */
const exchangeCodeForTokens = async (
  provider: AccountProvider,
  config: OAuthConfig,
  code: string
): Promise<OAuthTokens> => {
  console.log('[OAuth] Scambio codice per token...', {
    provider,
    tokenUrl: config.tokenUrl,
    redirectUri: config.redirectUri,
    codeLength: code.length,
  });

  const requestBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody,
    });

    const responseText = await response.text();
    console.log('[OAuth] Risposta token:', {
      status: response.status,
      statusText: response.statusText,
      body: responseText.substring(0, 200),
    });

    if (!response.ok) {
      throw new Error(`Errore nello scambio del codice (${response.status}): ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Errore nel parsing della risposta: ${responseText}`);
    }

    if (!data.access_token) {
      throw new Error(`Token di accesso non presente nella risposta: ${JSON.stringify(data)}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      tokenType: data.token_type || 'Bearer',
    };
  } catch (error) {
    console.error('[OAuth] Errore nello scambio del codice:', error);
    throw error;
  }
};


/**
 * Aggiorna un token di accesso usando il refresh token
 */
export const refreshAccessToken = async (
  provider: AccountProvider,
  refreshToken: string
): Promise<OAuthTokens> => {
  const config = getProviderConfig(provider);

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
