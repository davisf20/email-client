/**
 * Hook React Query per la gestione dei messaggi
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messageStorage, syncMessages } from '@mail-client/core';
import { useMailStore } from '../store/useMailStore';
import type { Account, MailFolder } from '@mail-client/core';

export const useMessages = (folderId: string | null) => {
  const { setMessages, currentAccountId, accounts } = useMailStore();
  
  return useQuery({
    queryKey: ['messages', folderId],
    queryFn: async () => {
      if (!folderId) {
        return [];
      }
      
      const messages = await messageStorage.getByFolder(folderId);
      setMessages(messages);
      return messages;
    },
    enabled: !!folderId,
  });
};

export const useSyncMessages = () => {
  const queryClient = useQueryClient();
  const { currentAccountId, currentFolderId, accounts, folders } = useMailStore();
  
  return useMutation({
    mutationFn: async () => {
      if (!currentAccountId || !currentFolderId) {
        throw new Error('Nessun account o cartella selezionata');
      }
      
      const account = accounts.find((a) => a.id === currentAccountId);
      const folder = folders.find((f) => f.id === currentFolderId);
      
      if (!account || !folder) {
        throw new Error('Account o cartella non trovati');
      }
      
      const messages = await syncMessages(account, folder.path);
      
      // Salva i messaggi nello storage
      for (const message of messages) {
        await messageStorage.save(message);
      }
      
      return messages;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
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

