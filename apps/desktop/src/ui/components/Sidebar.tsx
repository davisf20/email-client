/**
 * Componente Sidebar per la navigazione account e cartelle
 */

import React from 'react';
import { Mail, Settings, Folder, Inbox, Star, Archive, Trash2 } from 'lucide-react';
import { useMailStore } from '../store/useMailStore';
import { useAccounts } from '../hooks/useAccounts';
import { Button, cn } from '@mail-client/ui-kit';
import { AccountMenu } from './AccountMenu';

export const Sidebar: React.FC = () => {
  const { accounts, currentAccountId, folders, currentFolderId, setCurrentFolder, setSettingsOpen } = useMailStore();
  useAccounts();
  
  const currentAccount = accounts.find((a) => a.id === currentAccountId);
  
  const defaultFolders = [
    { id: 'inbox', name: 'Inbox', icon: Inbox },
    { id: 'starred', name: 'Starred', icon: Star },
    { id: 'archive', name: 'Archive', icon: Archive },
    { id: 'trash', name: 'Trash', icon: Trash2 },
  ];

  return (
    <div className="w-64 bg-dark-surface border-r border-dark-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-blue-500" />
            <h1 className="text-xl font-bold text-white">Mail Client</h1>
          </div>
        </div>
        
        {/* Account menu */}
        <AccountMenu />
      </div>

      {/* Folders */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {defaultFolders.map((folder) => {
            const Icon = folder.icon;
            const isActive = currentFolderId === folder.id;
            
            return (
              <button
                key={folder.id}
                onClick={() => setCurrentFolder(folder.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                  isActive
                    ? 'bg-blue-600/20 text-blue-300'
                    : 'text-dark-textMuted hover:bg-dark-surfaceHover hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{folder.name}</span>
              </button>
            );
          })}
        </div>

        {/* Custom folders */}
        {folders.length > 0 && (
          <div className="mt-4">
            <div className="px-3 py-2 text-xs font-semibold text-dark-textMuted uppercase">
              Cartelle
            </div>
            <div className="space-y-1">
              {folders.map((folder) => {
                const isActive = currentFolderId === folder.id;
                
                return (
                  <button
                    key={folder.id}
                    onClick={() => setCurrentFolder(folder.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                      isActive
                        ? 'bg-blue-600/20 text-blue-300'
                        : 'text-dark-textMuted hover:bg-dark-surfaceHover hover:text-white'
                    )}
                  >
                    <Folder className="h-4 w-4" />
                    <span className="text-sm font-medium">{folder.name}</span>
                    {folder.unreadCount > 0 && (
                      <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                        {folder.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-dark-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Impostazioni
        </Button>
      </div>
    </div>
  );
};

