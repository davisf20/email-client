/**
 * Componente AccountMenu per gestire account e aggiunta nuovi account
 */

import React, { useState, useEffect } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Plus, Mail, Check, LogOut } from 'lucide-react';
import { useMailStore } from '../store/useMailStore';
import { useAccounts, useAddAccount, useRemoveAccount } from '../hooks/useAccounts';
import { Avatar } from '@mail-client/ui-kit';
import { cn } from '@mail-client/ui-kit';
import { getOAuthUrl, exchangeOAuthCode, getUserInfo, getOAuthRedirectUri, accountStorage } from '@mail-client/core';
import type { AccountProvider } from '@mail-client/core';
import { OAuthUrlInputModal } from './OAuthUrlInputModal';

export const AccountMenu: React.FC = () => {
  const { accounts, currentAccountId, setCurrentAccount, setIsLoggingOut } = useMailStore();
  useAccounts(); // Carica gli account
  const addAccountMutation = useAddAccount();
  const removeAccountMutation = useRemoveAccount();
  
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [showProviderSelect, setShowProviderSelect] = useState(false);
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<AccountProvider | null>(null);

  // Helper per mostrare dialog/alert
  const showDialog = async (message: string, title: string = 'Info', kind: 'info' | 'warning' | 'error' = 'info') => {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { message: messageFn } = await import('@tauri-apps/plugin-dialog');
        await messageFn(message, { title, kind });
      } else {
        alert(message);
      }
    } catch (error) {
      alert(message);
    }
  };

  const currentAccount = accounts.find((a) => a.id === currentAccountId);
  

  const handleAddAccount = async (provider: AccountProvider) => {
    try {
      console.log('[AccountMenu] Aggiunta account iniziata per provider:', provider);
      console.log('[AccountMenu] Window object:', typeof window !== 'undefined' ? 'available' : 'not available');
      console.log('[AccountMenu] __TAURI__:', typeof window !== 'undefined' ? (window as any).__TAURI__ : 'N/A');
      console.log('[AccountMenu] __TAURI_INTERNALS__:', typeof window !== 'undefined' ? (window as any).__TAURI_INTERNALS__ : 'N/A');
      
      setIsAddingAccount(true);
      setShowProviderSelect(false);

      // Verifica se siamo in Tauri
      const isTauri = typeof window !== 'undefined' && 
                      ((window as any).__TAURI__ !== undefined || 
                       (window as any).__TAURI_INTERNALS__ !== undefined);

      console.log('[AccountMenu] Is Tauri:', isTauri);

      if (isTauri) {
        // In Tauri, usa WebviewWindow per aprire OAuth dentro l'app e intercettare automaticamente il redirect
        console.log('[AccountMenu] Tauri rilevato, uso WebviewWindow per OAuth');
        const authUrl = getOAuthUrl(provider);
        console.log('[AccountMenu] URL di autorizzazione:', authUrl);
        
        try {
          // Prova a usare WebviewWindow per aprire OAuth in una finestra Tauri
          const windowModule = await new Function('return import("@tauri-apps/api/window")')();
          const { WebviewWindow } = windowModule;
          
          console.log('[AccountMenu] Creo WebviewWindow per OAuth');
          const oauthWindow = new WebviewWindow('oauth', {
            url: authUrl,
            title: `${provider === 'gmail' ? 'Google' : 'Microsoft'} Login`,
            width: 600,
            height: 700,
            visible: true,
            focus: true,
            center: true,
            resizable: false,
            decorations: true,
          });
          
          // Aspetta che la finestra sia creata
          await oauthWindow.once('tauri://created');
          console.log('[AccountMenu] WebviewWindow creata');
          
          // Intercetta la navigazione per catturare il redirect
          // In Tauri v2, possiamo usare eventi di navigazione
          return new Promise<void>((resolve, reject) => {
            let hasReceivedCode = false;
            const redirectUri = 'http://localhost:1420/oauth/callback';
            
            console.log('[AccountMenu] Aspetto redirect a:', redirectUri);
            
            // Listener per intercettare il redirect usando eventi di navigazione
            const navigationHandler = async (url: string) => {
              console.log('[AccountMenu] Navigazione rilevata:', url);
              
              if (url && url.includes('/oauth/callback')) {
                console.log('[AccountMenu] Redirect intercettato!');
                hasReceivedCode = true;
                
                // Estrai il codice dall'URL
                try {
                  const urlObj = new URL(url);
                  const code = urlObj.searchParams.get('code');
                  const error = urlObj.searchParams.get('error');
                  
                  if (error) {
                    oauthWindow.close();
                    reject(new Error(`Errore OAuth: ${error}`));
                    return;
                  }
                  
                  if (!code) {
                    oauthWindow.close();
                    reject(new Error('Codice di autorizzazione non trovato nell\'URL'));
                    return;
                  }
                  
                  console.log('[AccountMenu] Codice estratto, chiudo finestra e completo login');
                  oauthWindow.close();
                  
                  // Completa il setup dell'account
                  await completeAccountSetup(provider, code);
                  resolve();
                } catch (err) {
                  oauthWindow.close();
                  reject(new Error(`Errore nel parsing dell'URL: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`));
                }
              }
            };
            
            // Usa l'evento di navigazione della webview
            oauthWindow.listen('tauri://navigation', (event: any) => {
              if (event.payload && event.payload.url) {
                navigationHandler(event.payload.url);
              }
            });
            
            // Fallback: controlla periodicamente l'URL corrente
            const checkInterval = setInterval(async () => {
              try {
                const currentUrl = await oauthWindow.url();
                if (currentUrl) {
                  await navigationHandler(currentUrl);
                }
              } catch (err) {
                // Ignora errori di accesso all'URL
              }
            }, 500);
            
            // Timeout dopo 5 minuti
            setTimeout(() => {
              if (!hasReceivedCode) {
                clearInterval(checkInterval);
                oauthWindow.close();
                reject(new Error('Timeout durante l\'autorizzazione OAuth'));
              }
            }, 5 * 60 * 1000);
            
            // Listener per quando la finestra viene chiusa manualmente
            oauthWindow.once('tauri://close-requested', () => {
              if (!hasReceivedCode) {
                clearInterval(checkInterval);
                reject(new Error('Finestra OAuth chiusa dall\'utente'));
              }
            });
          });
        } catch (windowError) {
          console.warn('[AccountMenu] WebviewWindow non disponibile, uso browser esterno:', windowError);
          
          // Fallback: usa browser esterno e chiedi all'utente di incollare l'URL
          // NOTA: Questo è necessario perché il redirect URI funziona solo dentro l'app Tauri
          try {
            console.log('[AccountMenu] Provo con comando Rust personalizzato...');
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('open_url_in_browser', { url: authUrl });
            console.log('[AccountMenu] Browser aperto con comando Rust personalizzato');
            
            // Aspetta un momento per assicurarsi che il browser si apra
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Mostra il modal per inserire l'URL
            // IMPORTANTE: Quando usi il browser esterno, Google reindirizzerà a localhost:1420
            // che non esiste nel browser esterno. Devi copiare l'URL COMPLETO dalla barra degli indirizzi
            // PRIMA che Google tenti il redirect, oppure usare un redirect URI diverso.
            console.log('[AccountMenu] Mostro modal OAuth');
            setCurrentProvider(provider);
            setShowOAuthModal(true);
          } catch (rustError) {
            console.error('[AccountMenu] Errore nell\'apertura del browser:', rustError);
            throw new Error(`Errore nell'apertura del browser: ${rustError instanceof Error ? rustError.message : 'Errore sconosciuto'}`);
          }
        }
      } else {
        // In browser, usa il flusso normale con window.open
        console.log('[AccountMenu] Browser normale, uso window.open');
        const authUrl = getOAuthUrl(provider);
        const oauthWindow = window.open(authUrl, 'oauth', 'width=600,height=700');
        
        if (!oauthWindow) {
          throw new Error('Impossibile aprire la finestra OAuth. Verifica che i popup non siano bloccati.');
        }

        // Aspetta il codice dalla finestra OAuth
        const code = await new Promise<string>((resolve, reject) => {
          const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'oauth-code') {
              window.removeEventListener('message', handleMessage);
              resolve(event.data.code);
            } else if (event.data && event.data.type === 'oauth-error') {
              window.removeEventListener('message', handleMessage);
              reject(new Error(`Errore OAuth: ${event.data.error}`));
            }
          };
          window.addEventListener('message', handleMessage);
        });

        await completeAccountSetup(provider, code);
      }
    } catch (error) {
      console.error('[AccountMenu] Errore durante l\'aggiunta dell\'account:', error);
      await showDialog(`Errore durante l'aggiunta dell'account: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`, 'Errore', 'error');
      setIsAddingAccount(false);
    }
  };

  const handleOAuthUrlSubmit = async (url: string) => {
    if (!currentProvider) return;

    try {
      console.log('[AccountMenu] URL OAuth ricevuto:', url);
      
      // Estrai il codice dall'URL
      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get('code');
      
      if (!code) {
        throw new Error('Codice non trovato nell\'URL fornito');
      }

      setShowOAuthModal(false);
      await completeAccountSetup(currentProvider, code);
    } catch (error) {
      console.error('[AccountMenu] Errore nel parsing dell\'URL:', error);
      await showDialog(`Errore: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`, 'Errore', 'error');
    }
  };

  const completeAccountSetup = async (provider: AccountProvider, code: string) => {
    try {
      console.log('[AccountMenu] Scambio codice OAuth...');
      // Scambia il codice con i token
      const tokens = await exchangeOAuthCode(provider, code);
      console.log('[AccountMenu] Token OAuth ottenuti:', { hasAccessToken: !!tokens.accessToken, hasRefreshToken: !!tokens.refreshToken });
      
      console.log('[AccountMenu] Ottengo informazioni utente...');
      // Ottieni le informazioni dell'utente
      const userInfo = await getUserInfo(provider, tokens.accessToken);
      console.log('[AccountMenu] Informazioni utente ottenute:', { email: userInfo.email, name: userInfo.name });

      // Crea l'account
      const account = {
        id: `${provider}-${userInfo.email}`,
        email: userInfo.email,
        provider,
        displayName: userInfo.name,
        tokens,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      console.log('[AccountMenu] Salvataggio account...');
      // Salva l'account
      await addAccountMutation.mutateAsync(account);
      console.log('[AccountMenu] Account salvato con successo');
      
      // Seleziona automaticamente il nuovo account
      setCurrentAccount(account.id);
      setCurrentProvider(null);
    } catch (error) {
      console.error('[AccountMenu] Errore durante il completamento dell\'account:', error);
      throw error;
    } finally {
      setIsAddingAccount(false);
    }
  };

  const handleRemoveAccount = async (accountId: string) => {
    if (confirm('Sei sicuro di voler rimuovere questo account?')) {
      await removeAccountMutation.mutateAsync(accountId);
      if (currentAccountId === accountId && accounts.length > 1) {
        const remainingAccounts = accounts.filter((a) => a.id !== accountId);
        if (remainingAccounts.length > 0) {
          setCurrentAccount(remainingAccounts[0].id);
        }
      }
    }
  };

  const handleLogout = async () => {
    if (!currentAccountId) {
      return;
    }
    
    const accountToLogout = currentAccountId;
    
    // Usa l'API Tauri per i dialog se disponibile, altrimenti usa confirm()
    let confirmed = false;
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { ask } = await import('@tauri-apps/plugin-dialog');
        confirmed = await ask('Do you want to disconnect this account? You will need to reconnect it to access again.', {
          title: 'Disconnect Account',
          kind: 'warning',
        });
      } else {
        confirmed = confirm('Do you want to disconnect this account? You will need to reconnect it to access again.');
      }
    } catch (error) {
      // Fallback a confirm() se l'API Tauri non è disponibile
      confirmed = confirm('Do you want to disconnect this account? You will need to reconnect it to access again.');
    }
    
    if (!confirmed) {
      return;
    }
    
    try {
      // Imposta il flag di logout per prevenire la ri-selezione automatica di account
      setIsLoggingOut(true);
      
      // Imposta currentAccountId a null PRIMA di rimuovere per fermare l'auto-sync
      setCurrentAccount(null);
      
      // Rimuovi l'account dal database e dallo store
      await removeAccountMutation.mutateAsync(accountToLogout);
      
      // Attendi un momento per assicurarsi che le query siano invalidate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verifica anche nel database PRIMA di resettare il flag
      const accountsInDb = await accountStorage.getAll();
      const accountStillExists = accountsInDb.some(a => a.id === accountToLogout);
      
      if (accountStillExists) {
        console.error('[AccountMenu] ERRORE: Account ancora presente nel database dopo la rimozione!');
        setIsLoggingOut(false);
        await showDialog('Errore: Impossibile rimuovere l\'account dal database. Prova a ricaricare l\'app.', 'Errore', 'error');
        return;
      }
      
      // Verifica lo stato dopo la rimozione
      const stateAfterRemoval = useMailStore.getState();
      
      // Reset il flag di logout SOLO dopo aver verificato che l'account è stato rimosso
      setIsLoggingOut(false);
      
      // Se non ci sono altri account, ricarica la pagina
      if (stateAfterRemoval.accounts.length === 0 && accountsInDb.length === 0) {
        window.location.reload();
      } else if (stateAfterRemoval.accounts.length > 0) {
        // Se ci sono altri account, seleziona il primo
        setCurrentAccount(stateAfterRemoval.accounts[0].id);
      } else {
        // Se lo store è vuoto ma il database ha ancora account, ricarica per sincronizzare
        window.location.reload();
      }
    } catch (error) {
      setIsLoggingOut(false);
      await showDialog(`Errore durante il logout: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`, 'Errore', 'error');
    }
  };

  return (
    <div>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            'p-2 rounded-full',
            'bg-white/50 hover:bg-white/70',
            'transition-colors cursor-pointer'
          )}
        >
          {currentAccount ? (
            <Avatar
              src={undefined}
              fallback={currentAccount.displayName}
              size="sm"
            />
          ) : (
            <Mail className="h-5 w-5 text-dark-textMuted" />
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(
            'min-w-[280px] bg-white/90 backdrop-blur-xl border border-black/10 rounded-2xl shadow-xl',
            'p-2 z-50',
            'animate-in fade-in-0 zoom-in-95'
          )}
          sideOffset={5}
          align="end"
        >
          {/* Lista account */}
          {accounts.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-dark-textMuted uppercase">
                Connected Accounts
              </div>
              {accounts.map((account) => (
                <DropdownMenu.Item
                  key={account.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer',
                    'outline-none focus:bg-white/80',
                    currentAccountId === account.id && 'bg-selected-bg text-selected-text'
                  )}
                  onSelect={() => setCurrentAccount(account.id)}
                >
                  <Avatar
                    src={undefined}
                    fallback={account.displayName}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium truncate', currentAccountId === account.id ? 'text-selected-text' : 'text-dark-text')}>
                      {account.displayName}
                    </p>
                    <p className="text-xs text-dark-textMuted truncate">
                      {account.email}
                    </p>
                  </div>
                  {currentAccountId === account.id && (
                    <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  )}
                  {accounts.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAccount(account.id);
                      }}
                      className="ml-2 p-1 rounded hover:bg-red-600/20 text-dark-textMuted hover:text-red-400"
                    >
                      <LogOut className="h-3 w-3" />
                    </button>
                  )}
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className="h-px bg-black/10 my-2" />
            </>
          )}

          {/* Pulsante Logout */}
          {currentAccountId && (
            <>
              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer',
                  'outline-none focus:bg-red-600/20 text-red-400 hover:bg-red-600/20'
                )}
                onSelect={async (e) => {
                  e.preventDefault();
                  try {
                    await handleLogout();
                  } catch (error) {
                    console.error('[AccountMenu] Errore nel gestore logout:', error);
                    await showDialog(`Errore durante il logout: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`, 'Errore', 'error');
                  }
                }}
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Logout</span>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-black/10 my-2" />
            </>
          )}

          {/* Selezione provider */}
          {showProviderSelect ? (
            <div className="space-y-1">
              <div className="px-2 py-1.5 text-xs font-semibold text-dark-textMuted uppercase">
                Select Provider
              </div>
              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer',
                  'outline-none focus:bg-white/80',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                disabled={isAddingAccount}
                onSelect={() => handleAddAccount('gmail')}
              >
                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
                  G
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-text">Gmail</p>
                  <p className="text-xs text-dark-textMuted">Google</p>
                </div>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer',
                  'outline-none focus:bg-white/80',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                disabled={isAddingAccount}
                onSelect={() => handleAddAccount('outlook')}
              >
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                  O
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-text">Outlook</p>
                  <p className="text-xs text-dark-textMuted">Microsoft</p>
                </div>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={cn(
                  'px-3 py-2 rounded-md cursor-pointer',
                  'outline-none focus:bg-white/80 text-sm text-dark-textMuted'
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  setShowProviderSelect(false);
                }}
              >
                ← Back
              </DropdownMenu.Item>
            </div>
          ) : (
            <DropdownMenu.Item
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer',
                'outline-none focus:bg-white/80',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              disabled={isAddingAccount}
              onSelect={(e) => {
                e.preventDefault();
                setShowProviderSelect(true);
              }}
            >
              <Plus className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-dark-text">
                {isAddingAccount ? 'Connecting...' : 'Add account'}
              </span>
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>

    {/* Modal per inserire l'URL OAuth */}
    {currentProvider && (
      <OAuthUrlInputModal
        open={showOAuthModal}
        onClose={() => {
          setShowOAuthModal(false);
          setCurrentProvider(null);
          setIsAddingAccount(false);
        }}
        onSubmit={handleOAuthUrlSubmit}
        provider={currentProvider}
      />
    )}
    </div>
  );
};

