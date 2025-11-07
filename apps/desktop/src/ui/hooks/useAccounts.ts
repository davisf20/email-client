/**
 * Hook React Query per la gestione degli account
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountStorage } from '@mail-client/core';
import { useMailStore } from '../store/useMailStore';

export const useAccounts = () => {
  const { setAccounts, setCurrentAccount } = useMailStore();
  
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      console.log('[useAccounts] Caricamento account...');
      const accounts = await accountStorage.getAll();
      console.log('[useAccounts] Account caricati:', accounts.length, accounts);
      setAccounts(accounts);
      if (accounts.length > 0 && !useMailStore.getState().currentAccountId) {
        console.log('[useAccounts] Impostazione account corrente:', accounts[0].id);
        setCurrentAccount(accounts[0].id);
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
  const { removeAccount } = useMailStore();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await accountStorage.delete(id);
      removeAccount(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
};

