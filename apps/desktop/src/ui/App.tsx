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

  return (
    <div className="h-screen w-screen flex flex-col bg-dark-bg p-4 gap-4">
      <TopBar />
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Prima isola - Mail List (più piccola) */}
        <div className="w-96 bg-dark-surface rounded-[2rem] shadow-lg overflow-hidden flex-shrink-0">
          <MailList />
        </div>
        
        {/* Seconda isola - Mail Viewer */}
        <div className="flex-1 bg-dark-surface rounded-[2rem] shadow-lg overflow-hidden">
          <MailViewer />
        </div>
      </div>
      <FloatingMenu />
      <ComposeModal />
    </div>
  );
};

export default App;

