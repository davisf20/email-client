/**
 * Componente MailList per visualizzare la lista delle email
 */

import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { useMailStore } from '../store/useMailStore';
import { useMessages } from '../hooks/useMessages';
import { Avatar, cn } from '@mail-client/ui-kit';
import { Star, Paperclip } from 'lucide-react';

export const MailList: React.FC = () => {
  const { currentFolderId, messages, currentMessageId, setCurrentMessage, searchQuery } = useMailStore();
  const { isLoading } = useMessages(currentFolderId);

  // Filtra i messaggi in base alla cartella e alla ricerca
  const filteredMessages = React.useMemo(() => {
    let filtered = messages;

    // Filtra per cartella
    if (currentFolderId) {
      if (currentFolderId === 'inbox') {
        filtered = filtered.filter((msg) => !msg.flags.includes('\\Deleted') && !msg.flags.includes('\\Archive'));
      } else if (currentFolderId === 'favorites') {
        filtered = filtered.filter((msg) => msg.isStarred || msg.flags.includes('\\Flagged'));
      } else if (currentFolderId === 'draft') {
        filtered = filtered.filter((msg) => msg.flags.includes('\\Draft'));
      } else if (currentFolderId === 'sent') {
        filtered = filtered.filter((msg) => msg.flags.includes('\\Sent'));
      } else if (currentFolderId === 'archive') {
        filtered = filtered.filter((msg) => msg.flags.includes('\\Archive'));
      }
      // 'other' mostra tutti i messaggi
    }

    // Filtra per ricerca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((msg) => 
        msg.subject.toLowerCase().includes(query) ||
        msg.from.name?.toLowerCase().includes(query) ||
        msg.from.address.toLowerCase().includes(query) ||
        msg.text?.toLowerCase().includes(query) ||
        msg.to.some((addr) => addr.address.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [messages, currentFolderId, searchQuery]);

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return format(date, 'HH:mm');
    } else if (diffDays === 1) {
      return 'Ieri';
    } else if (diffDays < 7) {
      return formatDistanceToNow(date, { addSuffix: true, locale: it });
    } else {
      return format(date, 'd MMM', { locale: it });
    }
  };

  const groupMessagesByDate = (msgs: typeof messages) => {
    const groups: Record<string, typeof messages> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    msgs.forEach((msg) => {
      const msgDate = new Date(msg.date);
      msgDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let groupKey: string;
      if (diffDays === 0) {
        groupKey = 'Oggi';
      } else if (diffDays === 1) {
        groupKey = 'Ieri';
      } else if (diffDays < 7) {
        groupKey = 'Questa settimana';
      } else {
        groupKey = format(msgDate, 'MMMM yyyy', { locale: it });
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(msg);
    });
    
    return groups;
  };

  if (isLoading) {
    return (
      <div className="h-full bg-dark-surface p-4">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 w-full bg-dark-bg rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate(filteredMessages);

  return (
    <div className="h-full bg-dark-surface overflow-y-auto">
      {Object.entries(groupedMessages).map(([groupKey, msgs]) => (
        <div key={groupKey} className="mb-4">
          <div className="px-4 py-2 text-xs font-semibold text-dark-textMuted uppercase sticky top-0 bg-dark-surface z-10">
            {groupKey}
          </div>
          <div className="space-y-1 px-2">
            {msgs.map((message) => {
              const isSelected = currentMessageId === message.id;
              const senderName = message.from.name || message.from.address.split('@')[0];
              
              return (
                <div
                  key={message.id}
                  onClick={() => setCurrentMessage(message.id)}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-blue-600/20 border border-blue-600/30'
                      : 'hover:bg-dark-surface border border-transparent',
                    !message.isRead && 'bg-dark-surface/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={undefined}
                      fallback={senderName}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            'text-sm font-medium truncate',
                            !message.isRead ? 'text-white' : 'text-dark-textMuted'
                          )}>
                            {senderName}
                          </p>
                          {message.isStarred && (
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <span className="text-xs text-dark-textMuted flex-shrink-0 ml-2">
                          {formatDate(message.date)}
                        </span>
                      </div>
                      <p className={cn(
                        'text-sm truncate mb-1',
                        !message.isRead ? 'text-white font-medium' : 'text-dark-textMuted'
                      )}>
                        {message.subject}
                      </p>
                      <p className="text-xs text-dark-textMuted line-clamp-2">
                        {message.text || message.html?.replace(/<[^>]*>/g, '') || '(Nessun contenuto)'}
                      </p>
                      {message.attachments.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Paperclip className="h-3 w-3 text-dark-textMuted" />
                          <span className="text-xs text-dark-textMuted">
                            {message.attachments.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      
      {filteredMessages.length === 0 && (
        <div className="flex items-center justify-center h-full text-dark-textMuted">
          <p>{searchQuery ? 'Nessun risultato per la ricerca' : 'Nessun messaggio'}</p>
        </div>
      )}
    </div>
  );
};

