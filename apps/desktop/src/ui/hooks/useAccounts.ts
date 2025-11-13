/**
 * Hook React Query per la gestione degli account
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountStorage } from '@mail-client/core';
import { useMailStore } from '../store/useMailStore';

export const useAccounts = () => {
  const { setAccounts, setCurrentAccount, currentAccountId } = useMailStore();
  
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      console.log('[useAccounts] Caricamento account...');
      const accounts = await accountStorage.getAll();
      console.log('[useAccounts] Account caricati dal database:', accounts.length, accounts.map(a => ({ id: a.id, email: a.email })));
      
      const currentState = useMailStore.getState();
      console.log('[useAccounts] Stato corrente:', {
        accountsInStore: currentState.accounts.length,
        currentAccountId: currentState.currentAccountId,
        isLoggingOut: currentState.isLoggingOut,
      });
      
      setAccounts(accounts);
      
      // NON selezionare automaticamente un account se:
      // 1. Un logout è in corso
      // 2. C'è già un account selezionato
      if (currentState.isLoggingOut) {
        console.log('[useAccounts] Logout in corso, NON seleziono account automaticamente');
        return accounts;
      }
      
      // Seleziona automaticamente un account SOLO se:
      // 1. Ci sono account disponibili
      // 2. Non c'è già un account selezionato
      // 3. Lo store non ha account (per evitare di sovrascrivere durante il logout)
      if (accounts.length > 0 && !currentState.currentAccountId && currentState.accounts.length === 0) {
        console.log('[useAccounts] Impostazione account corrente automatica:', accounts[0].id);
        setCurrentAccount(accounts[0].id);
      } else if (accounts.length > 0 && currentState.currentAccountId) {
        // Verifica che l'account corrente esista ancora
        const currentAccountExists = accounts.some(a => a.id === currentState.currentAccountId);
        if (!currentAccountExists) {
          console.log('[useAccounts] Account corrente non esiste più, seleziono il primo disponibile');
          setCurrentAccount(accounts[0].id);
        } else {
          console.log('[useAccounts] Account corrente ancora valido:', currentState.currentAccountId);
        }
      } else {
        console.log('[useAccounts] Nessuna selezione automatica necessaria');
      }
      
      return accounts;
    },
  });
};

export const useAddAccount = () => {
  const queryClient = useQueryClient();
  const { addAccount } = useMailStore();
  
  return useMutation({
    mutationFn: async (account: Parameters<typeof accountStorage.save>[0]) => {
      await accountStorage.save(account);
      addAccount(account);
      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
};

export const useRemoveAccount = () => {
  const queryClient = useQueryClient();
  const { removeAccount, setCurrentAccount, setMessages, setFolders } = useMailStore();
  
  return useMutation({
    mutationFn: async (id: string) => {
      console.log('[useRemoveAccount] Rimozione account:', id);
      
      // Rimuovi dal database PRIMA di aggiornare lo store
      await accountStorage.delete(id);
      
      // Ottieni lo stato corrente PRIMA di rimuovere
      const stateBeforeRemoval = useMailStore.getState();
      const wasCurrentAccount = stateBeforeRemoval.currentAccountId === id;
      
      // Rimuovi dallo store
      removeAccount(id);
      
      // Se l'account rimosso era quello corrente, pulisci lo stato
      if (wasCurrentAccount) {
        console.log('[useRemoveAccount] Account corrente rimosso, pulizia stato');
        setMessages([]);
        setFolders([]);
        
        // Ottieni lo stato dopo la rimozione
        const stateAfterRemoval = useMailStore.getState();
        const remainingAccounts = stateAfterRemoval.accounts;
        
        if (remainingAccounts.length > 0) {
          console.log('[useRemoveAccount] Seleziono primo account rimanente:', remainingAccounts[0].id);
          setCurrentAccount(remainingAccounts[0].id);
        } else {
          console.log('[useRemoveAccount] Nessun account rimanente');
          setCurrentAccount(null);
        }
      }
      
      console.log('[useRemoveAccount] Account rimosso con successo');
    },
    onSuccess: (_, id) => {
      console.log('[useRemoveAccount] Invalidazione query per account rimosso:', id);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
};

