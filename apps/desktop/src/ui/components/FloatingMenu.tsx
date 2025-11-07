/**
 * Componente FloatingMenu - Menu floating in basso come nel mockup
 */

import React, { useState } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { Button, Input } from '@mail-client/ui-kit';
import { useMailStore } from '../store/useMailStore';
import { AccountMenu } from './AccountMenu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@mail-client/ui-kit';

export const FloatingMenu: React.FC = () => {
  const { setComposeOpen, currentFolderId, setCurrentFolder, setSearchQuery, folders } = useMailStore();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isOtherFoldersOpen, setIsOtherFoldersOpen] = useState(false);

  const mainFolders = [
    { id: 'inbox', icon: Inbox },
    { id: 'favorites', icon: Star },
    { id: 'draft', icon: FileText },
    { id: 'sent', icon: Send },
    { id: 'archive', icon: Archive },
  ];

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
      <div className="flex items-center gap-3 bg-dark-surface/60 backdrop-blur-md rounded-full px-6 py-3 border border-dark-border shadow-2xl min-w-[900px]">
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
                  'p-2 rounded-full transition-colors',
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-dark-textMuted hover:text-white hover:bg-dark-surfaceHover'
                )}
                title={folder.id.charAt(0).toUpperCase() + folder.id.slice(1)}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}

          {/* Other Folders dropdown */}
          <DropdownMenu.Root open={isOtherFoldersOpen} onOpenChange={setIsOtherFoldersOpen}>
            <DropdownMenu.Trigger asChild>
              <button
                className={cn(
                  'p-2 rounded-full transition-colors flex items-center gap-1',
                  currentFolderId && !mainFolders.find(f => f.id === currentFolderId) && folders.some(f => f.id === currentFolderId)
                    ? 'bg-blue-600 text-white' 
                    : 'text-dark-textMuted hover:text-white hover:bg-dark-surfaceHover'
                )}
                title="Other Folders"
              >
                <Folder className="h-5 w-5" />
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={cn(
                  'min-w-[200px] bg-dark-surface border border-dark-border rounded-lg shadow-xl',
                  'p-2 z-50 max-h-[300px] overflow-y-auto',
                  'animate-in fade-in-0 zoom-in-95'
                )}
                sideOffset={5}
                align="center"
              >
                {folders.length > 0 ? (
                  folders.map((folder) => {
                    const isActive = currentFolderId === folder.id;
                    return (
                      <DropdownMenu.Item
                        key={folder.id}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer',
                          'outline-none focus:bg-dark-surfaceHover',
                          isActive && 'bg-blue-600/20'
                        )}
                        onSelect={() => handleOtherFolderSelect(folder.id)}
                      >
                        <Folder className="h-4 w-4" />
                        <span className="text-sm text-white">{folder.name}</span>
                        {folder.unreadCount > 0 && (
                          <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                            {folder.unreadCount}
                          </span>
                        )}
                      </DropdownMenu.Item>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-sm text-dark-textMuted">
                    Nessuna cartella disponibile
                  </div>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Search */}
          {isSearchExpanded ? (
            <div className="flex items-center gap-2 bg-dark-bg rounded-full px-4 py-2 border border-dark-border">
              <Search className="h-4 w-4 text-dark-textMuted" />
              <Input
                type="text"
                placeholder="Cerca..."
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                className="bg-transparent border-0 focus:ring-0 focus:outline-none text-sm min-w-[200px]"
                autoFocus
              />
              <button
                onClick={handleSearchClose}
                className="p-1 rounded-full hover:bg-dark-surfaceHover transition-colors"
              >
                <X className="h-4 w-4 text-dark-textMuted" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSearchToggle}
              className="p-2 rounded-full hover:bg-dark-surfaceHover transition-colors"
              title="Cerca"
            >
              <Search className="h-5 w-5 text-dark-textMuted" />
            </button>
          )}
        </div>

        {/* Right side - Compose */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setComposeOpen(true)}
            className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-lg"
            title="Componi"
          >
            <Edit className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
