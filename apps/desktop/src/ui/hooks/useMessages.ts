/**
 * Hook React Query per la gestione dei messaggi
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messageStorage, syncMessages, syncFolders } from '@mail-client/core';
import { useMailStore } from '../store/useMailStore';
import type { Account, MailFolder } from '@mail-client/core';

export const useMessages = (folderId: string | null) => {
  const { setMessages, currentAccountId, accounts, folders } = useMailStore();
  
  return useQuery({
    queryKey: ['messages', folderId, currentAccountId],
    queryFn: async () => {
      if (!folderId || !currentAccountId) {
        return [];
      }
      
      // Mappa gli ID virtuali ('inbox', 'favorites', ecc.) agli ID reali delle cartelle
      let realFolderId = folderId;
      const account = accounts.find((a) => a.id === currentAccountId);
      
      if (account && ['inbox', 'favorites', 'draft', 'sent', 'archive'].includes(folderId)) {
        // Trova la cartella reale corrispondente
        if (folderId === 'inbox') {
          const inboxFolder = folders.find((f) => f.path === 'INBOX' || f.name === 'INBOX');
          if (inboxFolder) {
            realFolderId = inboxFolder.id;
          } else {
            // Fallback: cerca una cartella che contiene 'inbox' nel nome o path
            const fallbackFolder = folders.find((f) => 
              f.path.toLowerCase().includes('inbox') || f.name.toLowerCase().includes('inbox')
            );
            if (fallbackFolder) {
              realFolderId = fallbackFolder.id;
            }
          }
        } else if (folderId === 'sent') {
          const sentFolder = folders.find((f) => 
            f.path.toLowerCase().includes('sent') || f.name.toLowerCase().includes('sent')
          );
          if (sentFolder) {
            realFolderId = sentFolder.id;
          }
        } else if (folderId === 'draft') {
          const draftFolder = folders.find((f) => 
            f.path.toLowerCase().includes('draft') || f.name.toLowerCase().includes('draft')
          );
          if (draftFolder) {
            realFolderId = draftFolder.id;
          }
        } else if (folderId === 'archive') {
          const archiveFolder = folders.find((f) => 
            f.path.toLowerCase().includes('archive') || f.name.toLowerCase().includes('archive') ||
            f.path.toLowerCase().includes('all mail')
          );
          if (archiveFolder) {
            realFolderId = archiveFolder.id;
          }
        }
      }
      
      // Se abbiamo un ID reale di cartella, carica i messaggi
      if (realFolderId && realFolderId !== folderId) {
        let messages: any[] = [];
        
        try {
          messages = await messageStorage.getByFolder(realFolderId);
        } catch (error) {
          console.error('[useMessages] Errore nel caricamento dei messaggi:', error);
          messages = [];
        }
        
        // Se non ci sono messaggi, sincronizza
        if (messages.length === 0) {
          const folder = folders.find((f) => f.id === realFolderId);
          
          if (account && folder) {
            console.log('[useMessages] Nessun messaggio trovato, sincronizzazione...');
            try {
              const syncedMessages = await syncMessages(account, folder.path);
              
              // Aggiorna i messaggi con il folderId corretto
              const messagesWithFolderId = syncedMessages.map(msg => ({
                ...msg,
                folderId: realFolderId,
              }));
              
              // Salva i messaggi sincronizzati
              for (const message of messagesWithFolderId) {
                try {
                  await messageStorage.save(message);
                } catch (saveError) {
                  console.error('[useMessages] Errore nel salvataggio del messaggio:', saveError);
                }
              }
              
              messages = messagesWithFolderId;
              console.log('[useMessages] Messaggi sincronizzati:', messages.length);
            } catch (syncError) {
              console.error('[useMessages] Errore nella sincronizzazione:', syncError);
            }
          }
        }
        
        setMessages(messages);
        return messages;
      }
      
      // Per ID virtuali come 'favorites', filtra i messaggi da tutte le cartelle
      if (['favorites'].includes(folderId)) {
        // Carica tutti i messaggi e filtra per favorites
        const allMessages: any[] = [];
        for (const folder of folders) {
          try {
            const folderMessages = await messageStorage.getByFolder(folder.id);
            allMessages.push(...folderMessages);
          } catch (error) {
            console.error('[useMessages] Errore nel caricamento dei messaggi dalla cartella', folder.id, ':', error);
          }
        }
        
        const filtered = allMessages.filter((msg) => 
          msg.isStarred || msg.flags.includes('\\Flagged')
        );
        
        setMessages(filtered);
        return filtered;
      }
      
      // Fallback: carica tutti i messaggi e filtra per cartella virtuale
      const allMessages: any[] = [];
      const messageIds = new Set<string>(); // Per evitare duplicati
      
      // Se non ci sono cartelle, sincronizza prima
      if (folders.length === 0 && account) {
        console.log('[useMessages] Nessuna cartella trovata, sincronizzazione...');
        try {
          const syncedFolders = await syncFolders(account);
          // Le cartelle verranno aggiornate da App.tsx, quindi per ora continuiamo
        } catch (error) {
          console.error('[useMessages] Errore nella sincronizzazione delle cartelle:', error);
        }
      }
      
      // Trova la cartella corrispondente per sincronizzare solo quella
      let targetFolder: any = null;
      if (folderId === 'inbox') {
        targetFolder = folders.find((f) => f.path === 'INBOX' || f.name === 'INBOX' || f.path.toLowerCase().includes('inbox'));
      } else if (folderId === 'sent') {
        targetFolder = folders.find((f) => f.path.toLowerCase().includes('sent') || f.name.toLowerCase().includes('sent'));
      } else if (folderId === 'draft') {
        targetFolder = folders.find((f) => f.path.toLowerCase().includes('draft') || f.name.toLowerCase().includes('draft'));
      } else if (folderId === 'archive') {
        targetFolder = folders.find((f) => f.path.toLowerCase().includes('archive') || f.path.toLowerCase().includes('all mail'));
      }
      
      // Se abbiamo una cartella target, sincronizza solo quella
      if (targetFolder && account) {
        try {
          let folderMessages = await messageStorage.getByFolder(targetFolder.id);
          
          // Se non ci sono messaggi, sincronizza
          if (folderMessages.length === 0) {
            console.log('[useMessages] Nessun messaggio trovato nella cartella', targetFolder.name, ', sincronizzazione...');
            try {
              const syncedMessages = await syncMessages(account, targetFolder.path);
              
              // Aggiorna i messaggi con il folderId corretto
              const messagesWithFolderId = syncedMessages.map(msg => ({
                ...msg,
                folderId: targetFolder.id,
              }));
              
              // Salva i messaggi sincronizzati
              for (const message of messagesWithFolderId) {
                try {
                  await messageStorage.save(message);
                } catch (saveError) {
                  console.error('[useMessages] Errore nel salvataggio del messaggio:', saveError);
                }
              }
              
              folderMessages = messagesWithFolderId;
              console.log('[useMessages] Messaggi sincronizzati per', targetFolder.name, ':', folderMessages.length);
            } catch (syncError) {
              console.error('[useMessages] Errore nella sincronizzazione dei messaggi:', syncError);
            }
          }
          
          // Aggiungi solo messaggi unici
          for (const msg of folderMessages) {
            if (!messageIds.has(msg.id)) {
              messageIds.add(msg.id);
              allMessages.push(msg);
            }
          }
        } catch (error) {
          console.error('[useMessages] Errore nel caricamento dei messaggi dalla cartella', targetFolder.id, ':', error);
        }
      } else {
        // Se non abbiamo una cartella target, carica da tutte le cartelle
        for (const folder of folders) {
          try {
            const folderMessages = await messageStorage.getByFolder(folder.id);
            
            // Aggiungi solo messaggi unici
            for (const msg of folderMessages) {
              if (!messageIds.has(msg.id)) {
                messageIds.add(msg.id);
                allMessages.push(msg);
              }
            }
          } catch (error) {
            console.error('[useMessages] Errore nel caricamento dei messaggi dalla cartella', folder.id, ':', error);
          }
        }
      }
      
      // Filtra in base alla cartella virtuale
      let filtered = allMessages;
      if (folderId === 'inbox') {
        filtered = allMessages.filter((msg) => 
          !msg.flags.includes('\\Deleted') && !msg.flags.includes('\\Archive') && !msg.flags.includes('\\Sent') && !msg.flags.includes('\\Draft')
        );
      } else if (folderId === 'draft') {
        filtered = allMessages.filter((msg) => msg.flags.includes('\\Draft'));
      } else if (folderId === 'sent') {
        filtered = allMessages.filter((msg) => msg.flags.includes('\\Sent'));
      } else if (folderId === 'archive') {
        filtered = allMessages.filter((msg) => msg.flags.includes('\\Archive'));
      }
      
      console.log('[useMessages] Messaggi filtrati per', folderId, ':', filtered.length, '(unici:', messageIds.size, ')');
      setMessages(filtered);
      return filtered;
    },
    enabled: !!folderId && !!currentAccountId,
  });
};

export const useSyncMessages = () => {
  const queryClient = useQueryClient();
  const { currentAccountId, currentFolderId, accounts, folders, setFolders } = useMailStore();
  
  return useMutation({
    mutationFn: async () => {
      if (!currentAccountId) {
        throw new Error('Nessun account selezionato');
      }
      
      const account = accounts.find((a) => a.id === currentAccountId);
      
      if (!account) {
        throw new Error('Account non trovato');
      }
      
      console.log('[useSyncMessages] Sincronizzazione account:', account.email);
      
      // Prima sincronizza le cartelle
      const syncedFolders = await syncFolders(account);
      setFolders(syncedFolders);
      
      // Poi sincronizza i messaggi per ogni cartella
      const allMessages: any[] = [];
      
      for (const folder of syncedFolders) {
        console.log('[useSyncMessages] Sincronizzazione cartella:', folder.name);
        const messages = await syncMessages(account, folder.path);
        
        // Aggiorna i messaggi con il folderId corretto
        const messagesWithFolderId = messages.map(msg => ({
          ...msg,
          folderId: folder.id,
        }));
        
        // Salva i messaggi nello storage
        for (const message of messagesWithFolderId) {
          await messageStorage.save(message);
          allMessages.push(message);
        }
        
        // Aggiorna il conteggio della cartella
        await messageStorage.getByFolder(folder.id).then(msgs => {
          // Il conteggio viene aggiornato automaticamente quando salviamo i messaggi
        });
      }
      
      console.log('[useSyncMessages] Sincronizzazione completata:', allMessages.length, 'messaggi');
      
      return allMessages;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  const { updateMessage } = useMailStore();
  
  return useMutation({
    mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
      await messageStorage.markAsRead(id, read);
      updateMessage(id, { isRead: read });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
};

