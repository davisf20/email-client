/**
 * Store Zustand per la gestione dello stato dell'applicazione
 */

import { create } from 'zustand';
import type { Account, MailMessage, MailFolder, AppSettings } from '@mail-client/core';

interface MailState {
  // Account
  accounts: Account[];
  currentAccountId: string | null;
  
  // Cartelle
  folders: MailFolder[];
  currentFolderId: string | null;
  
  // Messaggi
  messages: MailMessage[];
  currentMessageId: string | null;
  
  // Impostazioni
  settings: AppSettings;
  
  // UI State
  isComposeOpen: boolean;
  isSettingsOpen: boolean;
  searchQuery: string;
  
  // Actions
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => void;
  removeAccount: (id: string) => void;
  setCurrentAccount: (id: string | null) => void;
  
  setFolders: (folders: MailFolder[]) => void;
  setCurrentFolder: (id: string | null) => void;
  
  setMessages: (messages: MailMessage[]) => void;
  addMessage: (message: MailMessage) => void;
  updateMessage: (id: string, updates: Partial<MailMessage>) => void;
  removeMessage: (id: string) => void;
  setCurrentMessage: (id: string | null) => void;
  
  setSettings: (settings: AppSettings) => void;
  
  setComposeOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
}

export const useMailStore = create<MailState>((set) => ({
  // Initial state
  accounts: [],
  currentAccountId: null,
  folders: [],
  currentFolderId: null,
  messages: [],
  currentMessageId: null,
  settings: {
    theme: 'dark',
    notifications: true,
    syncInterval: 5,
    autoSync: true,
  },
  isComposeOpen: false,
  isSettingsOpen: false,
  searchQuery: '',
  
  // Actions
  setAccounts: (accounts) => set({ accounts }),
  addAccount: (account) => set((state) => ({ 
    accounts: [...state.accounts, account],
    currentAccountId: state.currentAccountId || account.id,
  })),
  removeAccount: (id) => set((state) => ({
    accounts: state.accounts.filter((a) => a.id !== id),
    currentAccountId: state.currentAccountId === id ? null : state.currentAccountId,
  })),
  setCurrentAccount: (id) => set({ currentAccountId: id }),
  
  setFolders: (folders) => set({ folders }),
  setCurrentFolder: (id) => set({ currentFolderId: id }),
  
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({
    messages: [message, ...state.messages],
  })),
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === id ? { ...msg, ...updates } : msg
    ),
  })),
  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter((msg) => msg.id !== id),
    currentMessageId: state.currentMessageId === id ? null : state.currentMessageId,
  })),
  setCurrentMessage: (id) => set({ currentMessageId: id }),
  
  setSettings: (settings) => set({ settings }),
  
  setComposeOpen: (open) => set({ isComposeOpen: open }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));

