/**
 * Componente FloatingMenu - Menu floating in basso come nel mockup
 */

import React, { useState, useMemo } from 'react';
import {
  Inbox,
  Star,
  FileText,
  Send,
  Archive,
  Folder,
  Search,
  Edit,
  X,
  ChevronDown,
} from 'lucide-react';
import { Input } from '@mail-client/ui-kit';
import { useMailStore } from '../store/useMailStore';
import { AccountMenu } from './AccountMenu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@mail-client/ui-kit';

export const FloatingMenu: React.FC = () => {
  const { setComposeOpen, currentFolderId, setCurrentFolder, setSearchQuery, folders } =
    useMailStore();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isOtherFoldersOpen, setIsOtherFoldersOpen] = useState(false);

  const mainFolders = [
    { id: 'inbox', icon: Inbox, name: 'Inbox' },
    { id: 'favorites', icon: Star, name: 'Favorites' },
    { id: 'draft', icon: FileText, name: 'Drafts' },
    { id: 'sent', icon: Send, name: 'Sent' },
    { id: 'archive', icon: Archive, name: 'Archive' },
  ];

  // Filtra le cartelle custom (escludi quelle principali)
  const customFolders = useMemo(() => {
    return folders.filter((folder) => {
      const path = folder.path.toLowerCase();
      const name = folder.name.toLowerCase();

      // Escludi le cartelle principali
      return (
        path !== 'inbox' &&
        !path.includes('sent') &&
        !path.includes('draft') &&
        !path.includes('archive') &&
        !path.includes('all mail') &&
        name !== 'inbox' &&
        name !== 'sent' &&
        name !== 'drafts' &&
        name !== 'archive'
      );
    });
  }, [folders]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
    setSearchQuery(value);
  };

  const handleSearchToggle = () => {
    if (isSearchExpanded && !searchValue) {
      setIsSearchExpanded(false);
      setSearchQuery('');
    } else {
      setIsSearchExpanded(true);
    }
  };

  const handleSearchClose = () => {
    setIsSearchExpanded(false);
    setSearchValue('');
    setSearchQuery('');
  };

  const handleOtherFolderSelect = (folderId: string) => {
    setCurrentFolder(folderId);
    setIsOtherFoldersOpen(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-white/70 backdrop-blur-xl rounded-full border border-black/10 px-6 py-3 shadow-2xl min-w-[900px]">
        {/* Left side - Account/Profile */}
        <div className="flex items-center gap-2">
          <AccountMenu />
        </div>

        {/* Center - Folder navigation */}
        <div className="flex items-center gap-1 flex-1 justify-center">
          {mainFolders.map((folder) => {
            const Icon = folder.icon;
            const isActive = currentFolderId === folder.id;

            return (
              <button
                key={folder.id}
                onClick={() => setCurrentFolder(folder.id)}
                className={cn(
                  'p-2 rounded-full transition-all duration-200',
                  isActive
                    ? 'bg-selected-bg text-selected-text shadow-sm'
                    : 'text-black hover:text-black/80 hover:bg-white/50'
                )}
                title={folder.name}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-selected-icon')} />
              </button>
            );
          })}

          {/* Other Folders dropdown - Solo cartelle custom */}
          {customFolders.length > 0 && (
            <DropdownMenu.Root open={isOtherFoldersOpen} onOpenChange={setIsOtherFoldersOpen}>
              <DropdownMenu.Trigger asChild>
                <button
                  className={cn(
                    'p-2 rounded-full transition-all duration-200 flex items-center gap-1',
                    currentFolderId &&
                      !mainFolders.find((f) => f.id === currentFolderId) &&
                      customFolders.some((f) => f.id === currentFolderId)
                      ? 'bg-selected-bg text-selected-text shadow-sm'
                      : 'text-dark-textMuted hover:text-dark-text hover:bg-white/50'
                  )}
                  title="Other Folders"
                >
                  <Folder
                    className={cn(
                      'h-5 w-5',
                      currentFolderId &&
                        !mainFolders.find((f) => f.id === currentFolderId) &&
                        customFolders.some((f) => f.id === currentFolderId) &&
                        'text-selected-icon'
                    )}
                  />
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className={cn(
                    'min-w-[200px] bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-black/10',
                    'p-2 z-50 max-h-[300px] overflow-y-auto',
                    'animate-in fade-in-0 zoom-in-95'
                  )}
                  sideOffset={5}
                  align="center"
                >
                  {customFolders.map((folder) => {
                    const isActive = currentFolderId === folder.id;
                    return (
                      <DropdownMenu.Item
                        key={folder.id}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer',
                          'outline-none focus:bg-white/80',
                          isActive && 'bg-selected-bg text-selected-text'
                        )}
                        onSelect={() => handleOtherFolderSelect(folder.id)}
                      >
                        <Folder className={cn('h-4 w-4', isActive && 'text-selected-icon')} />
                        <span
                          className={cn(
                            'text-sm',
                            isActive ? 'text-selected-text' : 'text-dark-text'
                          )}
                        >
                          {folder.name}
                        </span>
                        {folder.unreadCount > 0 && (
                          <span
                            className={cn(
                              'ml-auto text-xs px-2 py-0.5 rounded-full',
                              isActive
                                ? 'bg-selected-icon/20 text-selected-text'
                                : 'bg-blue-100 text-blue-700'
                            )}
                          >
                            {folder.unreadCount}
                          </span>
                        )}
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          {/* Search */}
          {isSearchExpanded ? (
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 border border-black/10">
              <Search className="h-4 w-4 text-black" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                className="bg-transparent border-0 focus:ring-0 focus:outline-none text-sm min-w-[200px] text-dark-text"
                autoFocus
              />
              <button
                onClick={handleSearchClose}
                className="p-1 rounded-full hover:bg-white/60 transition-colors"
              >
                <X className="h-4 w-4 text-black" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSearchToggle}
              className="p-2 rounded-full hover:bg-white/50 transition-colors"
              title="Search"
            >
              <Search className="h-5 w-5 text-black" />
            </button>
          )}
        </div>

        {/* Right side - Compose */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setComposeOpen(true)}
            className="p-3 rounded-full bg-dark-text hover:bg-dark-text/90 text-white transition-colors shadow-lg"
            title="Compose"
          >
            <Edit className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
