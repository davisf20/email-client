/**
 * Componente principale dell'applicazione
 */

import React, { useEffect } from 'react';
import { useAccounts } from './hooks/useAccounts';
import { TopBar } from './components/TopBar';
import { MailList } from './components/MailList';
import { MailViewer } from './components/MailViewer';
import { ComposeModal } from './components/ComposeModal';
import { FloatingMenu } from './components/FloatingMenu';
import { useMailStore } from './store/useMailStore';
import { syncFolders } from '@mail-client/core';

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
  const { data: accounts } = useAccounts();
  const { setFolders, currentAccountId, accounts: storeAccounts, currentFolderId, setCurrentFolder } = useMailStore();

  // Imposta la cartella di default
  useEffect(() => {
    if (!currentFolderId) {
      setCurrentFolder('inbox');
    }
  }, [currentFolderId, setCurrentFolder]);

  // Carica le cartelle quando cambia l'account
  useEffect(() => {
    if (currentAccountId && storeAccounts.length > 0) {
      const account = storeAccounts.find((a) => a.id === currentAccountId);
      if (account) {
        // Sincronizza le cartelle quando cambia l'account
        syncFolders(account).then((folders) => {
          setFolders(folders);
          // Se non c'è una cartella selezionata o è una cartella di default, seleziona la inbox
          if (!currentFolderId || currentFolderId === 'inbox') {
            const inboxFolder = folders.find((f) => f.path === 'INBOX' || f.name === 'INBOX');
            if (inboxFolder) {
              setCurrentFolder(inboxFolder.id);
            } else if (folders.length > 0) {
              setCurrentFolder(folders[0].id);
            }
          }
        }).catch((error) => {
          console.error('Errore nel caricamento delle cartelle:', error);
        });
      }
    }
  }, [currentAccountId, storeAccounts, setFolders, currentFolderId, setCurrentFolder]);

  // Applica l'effetto blur/vibrancy nativo quando il componente viene montato
  useEffect(() => {
    const applyWindowEffects = async () => {
      const windowModule = await getWindowModule();
      if (!windowModule) return;
      
      try {
        const appWindow = windowModule.appWindow;
        // Prova ad applicare l'effetto blur usando l'API nativa di Tauri 2.0
        await appWindow.setEffects({
          effects: ['blur'],
          state: 'active',
        });
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
          WebkitAppRegion: 'drag',
          background: 'transparent',
          paddingTop: '8px',
          paddingLeft: '12px',
          paddingRight: '12px'
        }}
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

