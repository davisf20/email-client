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

/**
 * Mappa i tag ai loro colori specifici
 * Ogni tag ha un colore di testo e uno sfondo più tenue
 */
const getTagColors = (tag: string): { textColor: string; bgColor: string } => {
  const tagColors: Record<string, { textColor: string; bgColor: string }> = {
    'Importante': { textColor: '#dc2626', bgColor: '#fee2e2' }, // Rosso
    'HR': { textColor: '#2563eb', bgColor: '#dbeafe' }, // Blu
    'Personale': { textColor: '#16a34a', bgColor: '#dcfce7' }, // Verde
    'Lavoro': { textColor: '#ea580c', bgColor: '#ffedd5' }, // Arancione
    'Famiglia': { textColor: '#9333ea', bgColor: '#f3e8ff' }, // Viola
    'Urgente': { textColor: '#dc2626', bgColor: '#fee2e2' }, // Rosso (stesso di Importante)
  };
  
  return tagColors[tag] || { textColor: '#1a1a1a', bgColor: '#e4e9e2' }; // Default
};

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
      <div className="h-full bg-transparent flex items-center justify-center text-black">
        <p>Select a message to view it</p>
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
    <div className="h-full bg-transparent flex flex-col overflow-hidden">
      {/* Header - Oggetto con label e data/ora */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-black">{message.subject}</h1>
            {messageLabels.length > 0 && (
              <div className="flex items-center gap-2">
                {messageLabels.map((label) => {
                  const colors = getTagColors(label);
                  return (
                    <span
                      key={label}
                      className="px-3 py-1.5 text-xs font-medium rounded-full"
                      style={{
                        backgroundColor: colors.bgColor,
                        color: colors.textColor
                      }}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div className="text-sm text-black whitespace-nowrap ml-4">
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
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-white/90 rounded-full text-sm text-black transition-colors shadow-sm"
              >
                <ChevronUp className="h-4 w-4" />
                <span>Previous messages ({olderMessages.length})</span>
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
                  className="rounded-3xl p-6 space-y-4 shadow-sm bg-baby-powder"
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
                        <p className="text-sm font-medium text-black">{msgSenderName}</p>
                        <span className="text-xs text-black">
                          {format(msg.date, "HH:mm", { locale: it })}
                        </span>
                      </div>
                      {index > 0 && (
                        <p className="text-xs text-black mb-2">{msg.subject}</p>
                      )}
                      <p className="text-xs text-black mb-2">&lt;{msg.from.address}&gt;</p>
                      {/* Destinatari */}
                      <div className="text-xs text-black space-y-0.5">
                        <p>A: {msgToAddresses}</p>
                        {msgCcAddresses && <p>Cc: {msgCcAddresses}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Separatore */}
                  {index > 0 && (
                    <div className="h-px bg-black/10 my-4" />
                  )}

                  {/* Allegati */}
                  {msg.attachments.length > 0 && (
                    <div className="p-3 bg-light-bg rounded-2xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Paperclip className="h-4 w-4 text-black" />
                            <span className="text-sm font-medium text-black">Attachments ({msg.attachments.length})</span>
                      </div>
                      <div className="space-y-2">
                        {msg.attachments.map((att, idx) => (
                          <div
                            key={`${msg.id}-att-${idx}-${att.filename}`}
                            className="flex items-center justify-between p-2 bg-white rounded-2xl"
                          >
                            <div className="flex items-center gap-2">
                              <Paperclip className="h-3 w-3 text-black" />
                              <span className="text-sm text-black">{att.filename}</span>
                              <span className="text-xs text-black">
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
                  <div className="prose max-w-none text-black">
                    {msg.html ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: msg.html }}
                        className="text-black"
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap text-black font-sans">
                        {msg.text || '(No content)'}
                      </pre>
                    )}
                  </div>

                {/* Azioni Reply/Forward solo per il messaggio corrente */}
                {isCurrentMessage && (
                  <div className="flex items-center gap-2 pt-4 justify-end">
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-black transition-colors bg-silver-25 hover:bg-silver-35"
                    >
                      <Reply className="h-4 w-4" />
                      <span>Reply</span>
                    </button>
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-black transition-colors bg-silver-25 hover:bg-silver-35"
                    >
                      <ReplyAll className="h-4 w-4" />
                      <span>Reply All</span>
                    </button>
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-black transition-colors bg-silver-25 hover:bg-silver-35"
                    >
                      <Forward className="h-4 w-4" />
                      <span>Forward</span>
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
