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
  composeData: { to?: string; cc?: string; bcc?: string; subject?: string; body?: string } | null;
  searchQuery: string;
  selectedTag: string | null; // Tag selezionato per il filtro
  availableTags: string[]; // Lista di tutti i tag disponibili (escluso "All")
  isLoggingOut: boolean; // Flag per indicare che un logout è in corso
  
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
  
  setComposeOpen: (open: boolean, data?: { to?: string; cc?: string; bcc?: string; subject?: string; body?: string }) => void;
  setSettingsOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTag: (tag: string | null) => void;
  addAvailableTag: (tag: string) => void;
  removeAvailableTag: (tag: string) => void;
  setIsLoggingOut: (isLoggingOut: boolean) => void;
}

export const useMailStore = create<MailState>((set) => ({
  // Initial state
  accounts: [],
  currentAccountId: null,
  folders: [],
  currentFolderId: 'inbox', // Imposta inbox come default
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
  composeData: null as { to?: string; cc?: string; bcc?: string; subject?: string; body?: string } | null,
  searchQuery: '',
  selectedTag: null,
  availableTags: ['Importante', 'HR'], // Tag predefiniti
  isLoggingOut: false, // Flag per logout
  
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
  
  setComposeOpen: (open, data?: { to?: string; cc?: string; bcc?: string; subject?: string; body?: string }) => set({ 
    isComposeOpen: open,
    composeData: open && data ? data : null,
  }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedTag: (tag) => set({ selectedTag: tag }),
  addAvailableTag: (tag) => set((state) => {
    if (!state.availableTags.includes(tag)) {
      return { availableTags: [...state.availableTags, tag] };
    }
    return state;
  }),
  removeAvailableTag: (tag) => set((state) => ({
    availableTags: state.availableTags.filter((t) => t !== tag),
  })),
  setIsLoggingOut: (isLoggingOut) => set({ isLoggingOut }),
}));

