/**
 * Componente MailViewer per visualizzare il contenuto completo di un'email con supporto thread
 */

import React, { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useMailStore } from '../store/useMailStore';
import { Avatar, Badge, Button } from '@mail-client/ui-kit';
import { Paperclip, Download, Reply, ReplyAll, Forward, ChevronUp } from 'lucide-react';
import { messageStorage } from '@mail-client/core';
import type { MailMessage } from '@mail-client/core';

export const MailViewer: React.FC = () => {
  const { messages, currentMessageId, setCurrentMessage } = useMailStore();
  const [threadMessages, setThreadMessages] = useState<MailMessage[]>([]);
  const [showOlderMessages, setShowOlderMessages] = useState(false);
  
  const message = messages.find((m) => m.id === currentMessageId);
  
  // Carica i messaggi del thread quando cambia il messaggio corrente
  useEffect(() => {
    if (message) {
      const threadId = message.threadId || message.messageId;
      // Trova tutti i messaggi dello stesso thread
      const allThreadMessages = messages.filter(
        (m) => (m.threadId || m.messageId) === threadId
      );
      
      // Ordina per data (più vecchi prima)
      const sorted = allThreadMessages.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      setThreadMessages(sorted);
    } else {
      setThreadMessages([]);
    }
  }, [message, messages]);
  
  // Raggruppa i messaggi per thread
  const threadGroup = useMemo(() => {
    if (!message) return [];
    return threadMessages.length > 0 ? threadMessages : [message];
  }, [message, threadMessages]);
  
  if (!message) {
    return (
      <div className="h-full bg-dark-surface flex items-center justify-center text-dark-textMuted">
        <p>Seleziona un messaggio per visualizzarlo</p>
      </div>
    );
  }

  const senderName = message.from.name || message.from.address.split('@')[0];
  const toAddresses = message.to.map((addr) => addr.address).join(', ');
  const ccAddresses = message.cc?.map((addr) => addr.address).join(', ');
  
  // Label del messaggio (basati su flags e isImportant)
  const messageLabels: string[] = [];
  if (message.isImportant) {
    messageLabels.push('Importante');
  }
  if (message.flags.includes('\\Flagged')) {
    messageLabels.push('HR');
  }

  // Messaggi più vecchi da mostrare
  const olderMessages = threadGroup.slice(0, -1);
  const currentMessageIndex = threadGroup.length - 1;
  const messagesToShow = showOlderMessages ? threadGroup : [message];

  return (
    <div className="h-full bg-dark-surface flex flex-col overflow-hidden">
      {/* Header - Oggetto con label e data/ora */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-white">{message.subject}</h1>
            {messageLabels.length > 0 && (
              <div className="flex items-center gap-2">
                {messageLabels.map((label) => (
                  <span
                    key={label}
                    className="bg-blue-600 text-white px-3 py-1.5 text-xs font-medium rounded-full"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-sm text-dark-textMuted whitespace-nowrap ml-4">
            {format(message.date, "d MMM yyyy, HH:mm", { locale: it })}
          </div>
        </div>
      </div>

      {/* Content Area - Scrollabile */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 flex items-center">
        <div className="w-full mx-auto">
          {/* Pulsante per mostrare messaggi più vecchi */}
          {olderMessages.length > 0 && !showOlderMessages && (
            <div className="mb-4 flex justify-center">
              <button
                onClick={() => setShowOlderMessages(true)}
                className="flex items-center gap-2 px-4 py-2 bg-dark-bg hover:bg-dark-surfaceHover rounded-full text-sm text-dark-textMuted hover:text-white transition-colors"
              >
                <ChevronUp className="h-4 w-4" />
                <span>Messaggi precedenti ({olderMessages.length})</span>
              </button>
            </div>
          )}

          {/* Lista dei messaggi del thread */}
          <div className="space-y-4">
            {messagesToShow.map((msg, index) => {
              const msgSenderName = msg.from.name || msg.from.address.split('@')[0];
              const msgToAddresses = msg.to.map((addr) => addr.address).join(', ');
              const msgCcAddresses = msg.cc?.map((addr) => addr.address).join(', ');
              const isCurrentMessage = msg.id === message.id;
              
              return (
                <div
                  key={msg.id}
                  className="bg-dark-bg rounded-3xl p-6 space-y-4"
                >
                  {/* Mittente e destinatari */}
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={undefined}
                      fallback={msgSenderName}
                      size="md"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-white">{msgSenderName}</p>
                        <span className="text-xs text-dark-textMuted">
                          {format(msg.date, "HH:mm", { locale: it })}
                        </span>
                      </div>
                      {index > 0 && (
                        <p className="text-xs text-dark-textMuted mb-2">{msg.subject}</p>
                      )}
                      <p className="text-xs text-dark-textMuted mb-2">&lt;{msg.from.address}&gt;</p>
                      {/* Destinatari */}
                      <div className="text-xs text-dark-textMuted space-y-0.5">
                        <p>A: {msgToAddresses}</p>
                        {msgCcAddresses && <p>Cc: {msgCcAddresses}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Separatore */}
                  {index > 0 && (
                    <div className="h-px bg-dark-border my-4" />
                  )}

                  {/* Allegati */}
                  {msg.attachments.length > 0 && (
                    <div className="p-3 bg-dark-surface rounded-2xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Paperclip className="h-4 w-4 text-dark-textMuted" />
                        <span className="text-sm font-medium text-white">Allegati ({msg.attachments.length})</span>
                      </div>
                      <div className="space-y-2">
                        {msg.attachments.map((att, idx) => (
                          <div
                            key={`${msg.id}-att-${idx}-${att.filename}`}
                            className="flex items-center justify-between p-2 bg-dark-bg rounded-2xl"
                          >
                            <div className="flex items-center gap-2">
                              <Paperclip className="h-3 w-3 text-dark-textMuted" />
                              <span className="text-sm text-dark-textMuted">{att.filename}</span>
                              <span className="text-xs text-dark-textMuted">
                                ({(att.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contenuto del messaggio */}
                  <div className="prose prose-invert max-w-none text-white">
                    {msg.html ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: msg.html }}
                        className="text-white"
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap text-white font-sans">
                        {msg.text || '(Nessun contenuto)'}
                      </pre>
                    )}
                  </div>

                {/* Azioni Reply/Forward solo per il messaggio corrente */}
                {isCurrentMessage && (
                  <div className="flex items-center gap-2 pt-4 justify-end">
                    <button
                      className="flex items-center gap-2 px-4 py-2 bg-dark-surface hover:bg-dark-surfaceHover rounded-full text-sm text-dark-textMuted hover:text-white transition-colors"
                    >
                      <Reply className="h-4 w-4" />
                      <span>Rispondi</span>
                    </button>
                    <button
                      className="flex items-center gap-2 px-4 py-2 bg-dark-surface hover:bg-dark-surfaceHover rounded-full text-sm text-dark-textMuted hover:text-white transition-colors"
                    >
                      <ReplyAll className="h-4 w-4" />
                      <span>Rispondi a tutti</span>
                    </button>
                    <button
                      className="flex items-center gap-2 px-4 py-2 bg-dark-surface hover:bg-dark-surfaceHover rounded-full text-sm text-dark-textMuted hover:text-white transition-colors"
                    >
                      <Forward className="h-4 w-4" />
                      <span>Inoltra</span>
                    </button>
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Spacer per il floating menu */}
      <div className="h-24 flex-shrink-0" />
    </div>
  );
};
