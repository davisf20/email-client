/**
 * Componente MailList per visualizzare la lista delle email
 * Raggruppa i messaggi per thread e mostra solo l'ultimo messaggio di ogni thread
 */

import React, { useState, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { useMailStore } from '../store/useMailStore';
import { useMessages } from '../hooks/useMessages';
import { Avatar, cn } from '@mail-client/ui-kit';
import { Star, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';
import type { MailMessage } from '@mail-client/core';

interface ThreadGroup {
  threadId: string;
  latestMessage: MailMessage;
  allMessages: MailMessage[];
}

export const MailList: React.FC = () => {
  const { currentFolderId, messages, currentMessageId, setCurrentMessage, searchQuery } = useMailStore();
  const { isLoading } = useMessages(currentFolderId);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  // Filtra i messaggi in base alla cartella e alla ricerca
  const filteredMessages = useMemo(() => {
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

  // Raggruppa i messaggi per thread
  const threadGroups = useMemo(() => {
    const threadMap = new Map<string, MailMessage[]>();
    const standaloneMessages: MailMessage[] = [];

    // Funzione per ottenere l'ID del thread
    const getThreadId = (msg: MailMessage): string | null => {
      // Usa threadId se disponibile
      if (msg.threadId) {
        return msg.threadId;
      }
      
      // Altrimenti usa inReplyTo o references per costruire un threadId
      if (msg.inReplyTo) {
        return `thread-${msg.inReplyTo}`;
      }
      
      // Se ha references, usa il primo reference come threadId
      if (msg.references && msg.references.length > 0) {
        return `thread-${msg.references[0]}`;
      }
      
      // Se il subject inizia con "Re:" o "Fwd:", cerca altri messaggi con lo stesso subject normalizzato
      const normalizedSubject = msg.subject
        .replace(/^(Re:|Fwd:|Fw:)\s*/i, '')
        .trim()
        .toLowerCase();
      
      if (normalizedSubject !== msg.subject.toLowerCase()) {
        return `subject-${normalizedSubject}`;
      }
      
      return null;
    };

    // Raggruppa i messaggi per thread
    filteredMessages.forEach((msg) => {
      const threadId = getThreadId(msg);
      
      if (threadId) {
        if (!threadMap.has(threadId)) {
          threadMap.set(threadId, []);
        }
        threadMap.get(threadId)!.push(msg);
      } else {
        // Messaggio standalone (non fa parte di un thread)
        standaloneMessages.push(msg);
      }
    });

    // Crea i gruppi di thread con l'ultimo messaggio
    const groups: ThreadGroup[] = [];
    
    threadMap.forEach((threadMessages, threadId) => {
      // Ordina i messaggi del thread per data (più recente prima)
      threadMessages.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      // Il primo è l'ultimo messaggio (più recente)
      const latestMessage = threadMessages[0];
      const otherMessages = threadMessages.slice(1);
      
      groups.push({
        threadId,
        latestMessage,
        allMessages: threadMessages, // Mantieni tutti i messaggi ordinati per data decrescente
      });
    });

    // Ordina i gruppi per data dell'ultimo messaggio (più recente prima)
    groups.sort((a, b) => b.latestMessage.date.getTime() - a.latestMessage.date.getTime());

    // Aggiungi i messaggi standalone alla fine
    standaloneMessages.forEach((msg) => {
      groups.push({
        threadId: `standalone-${msg.id}`,
        latestMessage: msg,
        allMessages: [msg],
      });
    });

    return groups;
  }, [filteredMessages]);

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

  const groupThreadsByDate = (groups: ThreadGroup[]) => {
    const dateGroups: Record<string, ThreadGroup[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    groups.forEach((group) => {
      const msgDate = new Date(group.latestMessage.date);
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
      
      if (!dateGroups[groupKey]) {
        dateGroups[groupKey] = [];
      }
      dateGroups[groupKey].push(group);
    });
    
    return dateGroups;
  };

  const toggleThread = (threadId: string) => {
    setExpandedThreads((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(threadId)) {
        newSet.delete(threadId);
      } else {
        newSet.add(threadId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="h-full bg-dark-surface p-4">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 w-full bg-dark-bg rounded-3xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const groupedThreads = groupThreadsByDate(threadGroups);

  return (
    <div className="h-full bg-dark-surface overflow-y-auto">
      {Object.entries(groupedThreads).map(([groupKey, groups]) => (
        <div key={groupKey} className="mb-4">
          <div className="px-4 py-2 text-xs font-semibold text-dark-textMuted uppercase sticky top-0 bg-dark-surface z-10">
            {groupKey}
          </div>
          <div className="space-y-1 px-2">
            {groups.map((group) => {
              const isExpanded = expandedThreads.has(group.threadId);
              const hasMultipleMessages = group.allMessages.length > 1;
              
              return (
                <div key={group.threadId}>
                  {/* Ultimo messaggio del thread (sempre visibile) */}
                  <MessageListItem
                    message={group.latestMessage}
                    isSelected={currentMessageId === group.latestMessage.id}
                    formatDate={formatDate}
                    onSelect={() => setCurrentMessage(group.latestMessage.id)}
                    hasThread={hasMultipleMessages}
                    isThreadExpanded={isExpanded}
                    onToggleThread={() => toggleThread(group.threadId)}
                  />
                  
                  {/* Altri messaggi del thread (visibili solo se espanso) */}
                  {isExpanded && hasMultipleMessages && (
                    <div className="ml-4 border-l-2 border-dark-border pl-2 space-y-1">
                      {group.allMessages.slice(1).map((message) => (
                        <MessageListItem
                          key={message.id}
                          message={message}
                          isSelected={currentMessageId === message.id}
                          formatDate={formatDate}
                          onSelect={() => setCurrentMessage(message.id)}
                          isThreadMessage={true}
                        />
                      ))}
                    </div>
                  )}
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

/**
 * Componente per un singolo elemento della lista messaggi
 */
const MessageListItem: React.FC<{
  message: MailMessage;
  isSelected: boolean;
  formatDate: (date: Date) => string;
  onSelect: () => void;
  hasThread?: boolean;
  isThreadExpanded?: boolean;
  onToggleThread?: () => void;
  isThreadMessage?: boolean; // Se true, è un messaggio dentro un thread espanso
}> = ({ 
  message, 
  isSelected, 
  formatDate, 
  onSelect, 
  hasThread = false,
  isThreadExpanded = false,
  onToggleThread,
  isThreadMessage = false,
}) => {
  const senderName = message.from.name || message.from.address.split('@')[0];
  const previewText = message.text || message.html?.replace(/<[^>]*>/g, '') || '(Nessun contenuto)';

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleThread?.();
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        'p-3 rounded-3xl cursor-pointer transition-colors',
        isSelected
          ? 'bg-blue-600/20 border border-blue-600/30'
          : 'hover:bg-dark-bg/30 border border-transparent',
        !message.isRead && !isThreadMessage && 'bg-dark-bg/30',
        isThreadMessage && 'opacity-75'
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
                !message.isRead && !isThreadMessage ? 'text-white' : 'text-dark-textMuted'
              )}>
                {senderName}
              </p>
              {message.isStarred && (
                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasThread && onToggleThread && (
                <button
                  onClick={handleToggleClick}
                  className="p-1 rounded hover:bg-dark-surfaceHover transition-colors"
                  title={isThreadExpanded ? 'Nascondi storico' : 'Mostra storico'}
                >
                  {isThreadExpanded ? (
                    <ChevronUp className="h-4 w-4 text-dark-textMuted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-dark-textMuted" />
                  )}
                </button>
              )}
              <span className="text-xs text-dark-textMuted">
                {formatDate(message.date)}
              </span>
            </div>
          </div>
          <p className={cn(
            'text-sm truncate mb-1',
            !message.isRead && !isThreadMessage ? 'text-white font-medium' : 'text-dark-textMuted'
          )}>
            {message.subject}
          </p>
          <p className="text-xs text-dark-textMuted line-clamp-2">
            {previewText}
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
};
