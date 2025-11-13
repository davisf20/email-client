/**
 * Componente principale dell'applicazione
 */

import React, { useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { MailList } from './components/MailList';
import { MailViewer } from './components/MailViewer';
import { ComposeModal } from './components/ComposeModal';
import { FloatingMenu } from './components/FloatingMenu';
import { useMailStore } from './store/useMailStore';
import { syncFolders } from '@mail-client/core';
import { useAutoSync } from './hooks/useAutoSync';

// Import dinamico per evitare problemi con Vite
const getWindowModule = async () => {
  try {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return await import('@tauri-apps/api/window');
    }
    return null;
  } catch {
    return null;
  }
};

const App: React.FC = () => {
  const { setFolders, currentAccountId, accounts: storeAccounts, currentFolderId, setCurrentFolder, settings } = useMailStore();
  const foldersLoadedRef = useRef<string | null>(null);
  
  // Avvia sincronizzazione automatica
  useAutoSync(settings.syncInterval);

  // Imposta la cartella di default
  useEffect(() => {
    if (!currentFolderId) {
      setCurrentFolder('inbox');
    }
  }, [currentFolderId, setCurrentFolder]);

  // Carica le cartelle quando cambia l'account (solo una volta per account)
  // La sincronizzazione automatica si occuperà di aggiornare le cartelle
  useEffect(() => {
    // Se non c'è un account selezionato, pulisci le cartelle e resetta il flag
    if (!currentAccountId) {
      console.log('[App] Nessun account selezionato, pulizia cartelle');
      setFolders([]);
      foldersLoadedRef.current = null;
      return;
    }
    
    // Reset il flag quando cambia l'account
    if (foldersLoadedRef.current !== currentAccountId) {
      foldersLoadedRef.current = null;
    }
    
    if (currentAccountId && storeAccounts.length > 0 && foldersLoadedRef.current !== currentAccountId) {
      const account = storeAccounts.find((a) => a.id === currentAccountId);
      if (account) {
        // Verifica che l'account sia ancora valido prima di sincronizzare
        const currentState = useMailStore.getState();
        if (currentState.currentAccountId !== currentAccountId) {
          console.log('[App] Account cambiato durante il caricamento, annullo sync');
          return;
        }
        
        // Carica le cartelle solo se non sono già state caricate per questo account
        foldersLoadedRef.current = currentAccountId;
        console.log('[App] Caricamento cartelle per account:', account.email);
        syncFolders(account).then((syncedFolders) => {
          // Verifica di nuovo che l'account sia ancora valido dopo la sincronizzazione
          const stateAfterSync = useMailStore.getState();
          if (stateAfterSync.currentAccountId !== currentAccountId) {
            console.log('[App] Account cambiato durante la sincronizzazione, ignoro risultati');
            return;
          }
          
          setFolders(syncedFolders);
          // Se non c'è una cartella selezionata o è una cartella di default, seleziona la inbox
          if (!currentFolderId || currentFolderId === 'inbox') {
            const inboxFolder = syncedFolders.find((f) => f.path === 'INBOX' || f.name === 'INBOX');
            if (inboxFolder) {
              setCurrentFolder(inboxFolder.id);
            } else if (syncedFolders.length > 0) {
              setCurrentFolder(syncedFolders[0].id);
            }
          }
        }).catch((error) => {
          console.error('[App] Errore nel caricamento delle cartelle:', error);
          foldersLoadedRef.current = null; // Reset in caso di errore
        });
      } else {
        console.log('[App] Account non trovato nello store:', currentAccountId);
      }
    }
  }, [currentAccountId, storeAccounts, setFolders, currentFolderId, setCurrentFolder]);

  // Applica l'effetto blur/vibrancy nativo quando il componente viene montato
  useEffect(() => {
    const applyWindowEffects = async () => {
      const windowModule = await getWindowModule();
      if (!windowModule) return;
      
      try {
        // Prova ad applicare l'effetto blur usando l'API nativa di Tauri 2.0
        // Nota: L'API potrebbe non essere disponibile in tutte le versioni
        const windowModule = await import('@tauri-apps/api/window');
        const appWindow = (windowModule as any).appWindow || (windowModule as any).default?.appWindow;
        if (appWindow && typeof appWindow.setEffects === 'function') {
          await appWindow.setEffects({
            effects: ['blur'],
            state: 'active',
          });
        }
      } catch (error) {
        // Se l'API non è disponibile, usa solo CSS
        console.log('Effetto blur nativo non disponibile, usando solo CSS');
      }
    };
    
    applyWindowEffects();
  }, []);

  return (
    <div 
      className="h-screen w-screen flex flex-col" 
      style={{ 
        background: 'rgba(255, 255, 255, 0.3)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)'
      }}
    >
      {/* Barra draggable superiore per macOS - permette di trascinare la finestra */}
          <div 
            className="h-8 w-full flex-shrink-0"
            style={{ 
              WebkitAppRegion: 'drag' as any,
              background: 'transparent',
              paddingTop: '8px',
              paddingLeft: '12px',
              paddingRight: '12px'
            } as React.CSSProperties}
          />
      <div 
        className="flex-1 flex flex-col p-4 gap-4 overflow-hidden" 
        style={{ 
          background: 'transparent'
        }}
      >
        <TopBar />
        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Prima isola - Mail List (più piccola) */}
          <div className="w-96 rounded-[2rem] shadow-lg overflow-hidden flex-shrink-0 bg-anti-flash-white-90">
            <MailList />
          </div>
          
          {/* Seconda isola - Mail Viewer */}
          <div className="flex-1 rounded-[2rem] shadow-lg overflow-hidden bg-anti-flash-white-90">
            <MailViewer />
          </div>
        </div>
        <FloatingMenu />
      </div>
      <ComposeModal />
    </div>
  );
};

export default App;

