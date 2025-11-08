/**
 * Componente TopBar per azioni globali e ricerca
 */

import React, { useState, useMemo } from 'react';
import { Trash2, Archive, Folder, Star, Mail, RefreshCw, Plus, X } from 'lucide-react';
import { useMailStore } from '../store/useMailStore';
import { useSyncMessages } from '../hooks/useMessages';
import { Button, Input, cn } from '@mail-client/ui-kit';

export const TopBar: React.FC = () => {
  const { mutate: syncMessages, isPending: isSyncing } = useSyncMessages();
  const { 
    currentMessageId, 
    messages, 
    updateMessage, 
    removeMessage, 
    selectedTag, 
    setSelectedTag,
    availableTags,
    addAvailableTag,
  } = useMailStore();
  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');

  const currentMessage = messages.find((m) => m.id === currentMessageId);

  const handleSync = () => {
    syncMessages();
  };

  const handleDelete = () => {
    if (currentMessageId) {
      removeMessage(currentMessageId);
    }
  };

  const handleArchive = () => {
    if (currentMessageId) {
      updateMessage(currentMessageId, {
        flags: [...(currentMessage?.flags || []), '\\Archive'],
      });
    }
  };

  const handleMove = () => {
    // TODO: Implementare move to folder
    console.log('Move to folder');
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
        WebkitAppRegion: 'no-drag'
      }}
    >
      {/* Left side - Labels */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
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
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={!currentMessageId}
          title="Delete"
          className="bg-silver-25 hover:bg-silver-35 text-black rounded-xl"
        >
          <Trash2 className="h-4 w-4 text-black" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleArchive}
          disabled={!currentMessageId}
          title="Archive"
          className="bg-silver-25 hover:bg-silver-35 text-black rounded-xl"
        >
          <Archive className="h-4 w-4 text-black" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMove}
          disabled={!currentMessageId}
          title="Move"
          className="bg-silver-25 hover:bg-silver-35 text-black rounded-xl"
        >
          <Folder className="h-4 w-4 text-black" />
        </Button>
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
