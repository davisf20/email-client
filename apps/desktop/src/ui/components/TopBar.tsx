/**
 * Componente TopBar per azioni globali e ricerca
 */

import React, { useState } from 'react';
import { Trash2, Archive, Folder, Star, Mail, RefreshCw, Plus, X } from 'lucide-react';
import { useMailStore } from '../store/useMailStore';
import { useSyncMessages } from '../hooks/useMessages';
import { Button, Input } from '@mail-client/ui-kit';

export const TopBar: React.FC = () => {
  const { mutate: syncMessages, isPending: isSyncing } = useSyncMessages();
  const { currentMessageId, messages, updateMessage, removeMessage } = useMailStore();
  const [labels, setLabels] = useState(['Importante', 'HR', 'Personale']);
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
    if (newLabelName.trim() && !labels.includes(newLabelName.trim())) {
      setLabels([...labels, newLabelName.trim()]);
      setNewLabelName('');
      setIsAddingLabel(false);
    }
  };

  const handleRemoveLabel = (label: string) => {
    setLabels(labels.filter((l) => l !== label));
  };

  return (
    <div className="h-14 bg-dark-surface/60 backdrop-blur-md border-b border-dark-border flex items-center justify-between px-4 rounded-xl">
      {/* Left side - Labels */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-dark-bg rounded-full p-1">
          {labels.map((label) => (
            <div
              key={label}
              className="px-3 py-1 rounded-full bg-blue-600 text-white text-sm font-medium flex items-center gap-2"
            >
              {label}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveLabel(label);
                }}
                className="hover:bg-blue-700 rounded-full p-0.5"
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {isAddingLabel ? (
            <div className="flex items-center gap-1">
              <Input
                type="text"
                placeholder="Nome label..."
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
                className="h-7 px-2 text-sm bg-dark-surface border-dark-border"
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
              className="px-3 py-1 rounded-full text-dark-textMuted hover:text-white text-sm font-medium flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Nuovo
            </button>
          )}
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={!currentMessageId}
          title="Elimina"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleArchive}
          disabled={!currentMessageId}
          title="Archivia"
        >
          <Archive className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMove}
          disabled={!currentMessageId}
          title="Sposta"
        >
          <Folder className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFlagImportant}
          disabled={!currentMessageId}
          title="Segna come importante"
          className={currentMessage?.isImportant ? 'text-yellow-500' : ''}
        >
          <Star className={`h-4 w-4 ${currentMessage?.isImportant ? 'fill-yellow-500' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMarkUnread}
          disabled={!currentMessageId}
          title="Segna come non letto"
        >
          <Mail className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSync}
          disabled={isSyncing}
          title="Sincronizza email"
        >
          <RefreshCw className={isSyncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>
    </div>
  );
};
