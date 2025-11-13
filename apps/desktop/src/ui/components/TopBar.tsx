/**
 * Componente TopBar per azioni globali e ricerca
 */

import React, { useState } from 'react';
import { Trash2, Archive, Folder, Star, Mail, RefreshCw, Plus, X } from 'lucide-react';
import { useMailStore } from '../store/useMailStore';
import { useSyncMessages, useDeleteMessage, useMoveMessage } from '../hooks/useMessages';
import { Button, Input, cn } from '@mail-client/ui-kit';

export const TopBar: React.FC = () => {
  const { mutate: syncMessages, isPending: isSyncing } = useSyncMessages();
  const { mutate: deleteMessage, isPending: isDeleting } = useDeleteMessage();
  const { mutate: moveMessage, isPending: isMoving } = useMoveMessage();
  const { 
    currentMessageId, 
    messages, 
    updateMessage, 
    selectedTag, 
    setSelectedTag,
    availableTags,
    addAvailableTag,
    folders,
  } = useMailStore();
  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const currentMessage = messages.find((m) => m.id === currentMessageId);

  const handleSync = () => {
    syncMessages();
  };

  const handleDelete = () => {
    if (currentMessageId) {
      deleteMessage(currentMessageId);
    }
  };

  const handleArchive = () => {
    if (currentMessageId && currentMessage) {
      // Trova la cartella Archive
      const archiveFolder = folders.find((f) => 
        f.path.toLowerCase().includes('archive') || 
        f.name.toLowerCase().includes('archive') ||
        f.path.toLowerCase().includes('all mail')
      );
      
      if (archiveFolder) {
        moveMessage({ id: currentMessageId, targetFolderId: archiveFolder.id });
      } else {
        // Se non c'è una cartella Archive, aggiungi solo il flag
        updateMessage(currentMessageId, {
          flags: [...(currentMessage.flags || []), '\\Archive'],
        });
      }
    }
  };

  const handleMove = (targetFolderId: string) => {
    if (currentMessageId) {
      moveMessage({ id: currentMessageId, targetFolderId });
      setShowMoveMenu(false);
    }
  };

  const handleFlagImportant = () => {
    if (currentMessageId) {
      const isImportant = currentMessage?.isImportant || false;
      updateMessage(currentMessageId, {
        isImportant: !isImportant,
        flags: isImportant
          ? currentMessage?.flags.filter((f) => f !== '\\Important') || []
          : [...(currentMessage?.flags || []), '\\Important'],
      });
    }
  };

  const handleMarkUnread = () => {
    if (currentMessageId) {
      updateMessage(currentMessageId, {
        isRead: false,
        flags: currentMessage?.flags.filter((f) => f !== '\\Seen') || [],
      });
    }
  };

  const handleAddLabel = () => {
    const tagName = newLabelName.trim();
    if (tagName && !availableTags.includes(tagName)) {
      // Crea il nuovo tag
      addAvailableTag(tagName);
      setNewLabelName('');
      setIsAddingLabel(false);
    }
  };

  const handleTagClick = (tag: string) => {
    if (tag === 'All') {
      setSelectedTag(null); // "All" significa nessun filtro
    } else if (selectedTag === tag) {
      setSelectedTag(null); // Deseleziona se già selezionato
    } else {
      setSelectedTag(tag);
    }
  };

  return (
        <div 
          className="h-14 flex items-center justify-between px-4 rounded-3xl bg-anti-flash-white-90"
          style={{ 
            WebkitAppRegion: 'no-drag' as any,
          } as React.CSSProperties}
        >
          {/* Left side - Labels */}
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' as any } as React.CSSProperties}>
        <div className="flex items-center gap-1 rounded-full p-1">
          {/* Tag "All" sempre presente e non eliminabile */}
          <button
            onClick={() => handleTagClick('All')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
              selectedTag === null || selectedTag === 'All'
                ? 'bg-silver-35 text-black'
                : 'bg-silver-25 text-black hover:bg-silver-35'
            )}
          >
            All
          </button>
          
          {/* Altri tag disponibili */}
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                selectedTag === tag
                  ? 'bg-silver-35 text-black'
                  : 'bg-silver-25 text-black hover:bg-silver-35'
              )}
            >
              {tag}
            </button>
          ))}
          {isAddingLabel ? (
            <div className="flex items-center gap-1">
              <Input
                type="text"
                placeholder="Label name..."
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddLabel();
                  } else if (e.key === 'Escape') {
                    setIsAddingLabel(false);
                    setNewLabelName('');
                  }
                }}
                className="h-7 px-2 text-sm bg-white rounded-xl border border-black/10"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAddLabel}
                className="h-7 w-7"
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsAddingLabel(false);
                  setNewLabelName('');
                }}
                className="h-7 w-7"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingLabel(true)}
              className="px-3 py-1 rounded-md text-black hover:text-black/80 text-sm font-medium flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          )}
        </div>
      </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' as any } as React.CSSProperties}>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={!currentMessageId || isDeleting}
          title="Delete"
          className="bg-silver-25 hover:bg-silver-35 text-black rounded-xl"
        >
          <Trash2 className="h-4 w-4 text-black" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleArchive}
          disabled={!currentMessageId || isMoving}
          title="Archive"
          className="bg-silver-25 hover:bg-silver-35 text-black rounded-xl"
        >
          <Archive className="h-4 w-4 text-black" />
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            disabled={!currentMessageId || isMoving}
            title="Move"
            className="bg-silver-25 hover:bg-silver-35 text-black rounded-xl"
          >
            <Folder className="h-4 w-4 text-black" />
          </Button>
          {showMoveMenu && (
            <div className="absolute right-0 top-full mt-2 bg-white/90 backdrop-blur-xl border border-black/10 rounded-xl shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleMove(folder.id)}
                  className="w-full text-left px-4 py-2 hover:bg-black/5 text-black text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentMessage?.folderId === folder.id}
                >
                  {folder.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFlagImportant}
          disabled={!currentMessageId}
          title="Mark as important"
          className={cn(currentMessage?.isImportant ? 'text-yellow-500' : 'text-black', 'bg-silver-25 hover:bg-silver-35 rounded-xl')}
        >
          <Star className={`h-4 w-4 ${currentMessage?.isImportant ? 'fill-yellow-500 text-yellow-500' : 'text-black'}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMarkUnread}
          disabled={!currentMessageId}
          title="Mark as unread"
          className="bg-silver-25 hover:bg-silver-35 text-black rounded-xl"
        >
          <Mail className="h-4 w-4 text-black" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSync}
          disabled={isSyncing}
          title="Sync emails"
          className="bg-silver-25 hover:bg-silver-35 text-black rounded-xl"
        >
          <RefreshCw className={isSyncing ? 'h-4 w-4 animate-spin text-black' : 'h-4 w-4 text-black'} />
        </Button>
      </div>
    </div>
  );
};
