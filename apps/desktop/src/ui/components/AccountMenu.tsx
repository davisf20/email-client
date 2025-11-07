/**
 * Componente AccountMenu per gestire account e aggiunta nuovi account
 */

import React, { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Plus, Mail, Check, ChevronDown, LogOut } from 'lucide-react';
import { useMailStore } from '../store/useMailStore';
import { useAccounts, useAddAccount, useRemoveAccount } from '../hooks/useAccounts';
import { Avatar, Button } from '@mail-client/ui-kit';
import { cn } from '@mail-client/ui-kit';
import { startOAuth2, getUserInfo } from '@mail-client/core';
import type { AccountProvider } from '@mail-client/core';

export const AccountMenu: React.FC = () => {
  const { accounts, currentAccountId, setCurrentAccount } = useMailStore();
  useAccounts(); // Carica gli account
  const addAccountMutation = useAddAccount();
  const removeAccountMutation = useRemoveAccount();
  
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [showProviderSelect, setShowProviderSelect] = useState(false);

  const currentAccount = accounts.find((a) => a.id === currentAccountId);

  const handleAddAccount = async (provider: AccountProvider) => {
    try {
      setIsAddingAccount(true);
      setShowProviderSelect(false);

      // Avvia il flusso OAuth2
      const tokens = await startOAuth2(provider);
      
      // Ottieni le informazioni dell'utente
      const userInfo = await getUserInfo(provider, tokens.accessToken);

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

      // Salva l'account
      await addAccountMutation.mutateAsync(account);
      
      // Seleziona automaticamente il nuovo account
      setCurrentAccount(account.id);
    } catch (error) {
      console.error('Errore durante l\'aggiunta dell\'account:', error);
      alert(`Errore durante l'aggiunta dell'account: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
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

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            'p-2 rounded-full',
            'bg-dark-surfaceHover hover:bg-dark-surfaceHover/80',
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
            'min-w-[280px] bg-dark-surface border border-dark-border rounded-lg shadow-xl',
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
                Account collegati
              </div>
              {accounts.map((account) => (
                <DropdownMenu.Item
                  key={account.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer',
                    'outline-none focus:bg-dark-surfaceHover',
                    currentAccountId === account.id && 'bg-blue-600/20'
                  )}
                  onSelect={() => setCurrentAccount(account.id)}
                >
                  <Avatar
                    src={undefined}
                    fallback={account.displayName}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
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
              <DropdownMenu.Separator className="h-px bg-dark-border my-2" />
            </>
          )}

          {/* Selezione provider */}
          {showProviderSelect ? (
            <div className="space-y-1">
              <div className="px-2 py-1.5 text-xs font-semibold text-dark-textMuted uppercase">
                Seleziona provider
              </div>
              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer',
                  'outline-none focus:bg-dark-surfaceHover',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                disabled={isAddingAccount}
                onSelect={() => handleAddAccount('gmail')}
              >
                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
                  G
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Gmail</p>
                  <p className="text-xs text-dark-textMuted">Google</p>
                </div>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer',
                  'outline-none focus:bg-dark-surfaceHover',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                disabled={isAddingAccount}
                onSelect={() => handleAddAccount('outlook')}
              >
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                  O
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Outlook</p>
                  <p className="text-xs text-dark-textMuted">Microsoft</p>
                </div>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={cn(
                  'px-3 py-2 rounded-md cursor-pointer',
                  'outline-none focus:bg-dark-surfaceHover text-sm text-dark-textMuted'
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  setShowProviderSelect(false);
                }}
              >
                ← Indietro
              </DropdownMenu.Item>
            </div>
          ) : (
            <DropdownMenu.Item
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer',
                'outline-none focus:bg-dark-surfaceHover',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              disabled={isAddingAccount}
              onSelect={(e) => {
                e.preventDefault();
                setShowProviderSelect(true);
              }}
            >
              <Plus className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-white">
                {isAddingAccount ? 'Collegamento in corso...' : 'Aggiungi account'}
              </span>
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

