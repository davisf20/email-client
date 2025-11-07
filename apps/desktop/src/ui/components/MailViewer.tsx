/**
 * Componente MailViewer per visualizzare il contenuto completo di un'email
 */

import React from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useMailStore } from '../store/useMailStore';
import { Avatar, Badge, Button } from '@mail-client/ui-kit';
import { Paperclip, Download } from 'lucide-react';

export const MailViewer: React.FC = () => {
  const { messages, currentMessageId } = useMailStore();
  
  const message = messages.find((m) => m.id === currentMessageId);
  
  if (!message) {
    return (
      <div className="flex-1 bg-dark-bg flex items-center justify-center text-dark-textMuted">
        <p>Seleziona un messaggio per visualizzarlo</p>
      </div>
    );
  }

  const senderName = message.from.name || message.from.address.split('@')[0];
  const toAddresses = message.to.map((addr) => addr.address).join(', ');
  const ccAddresses = message.cc?.map((addr) => addr.address).join(', ');

  return (
    <div className="h-full bg-dark-surface flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-dark-border">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-2">{message.subject}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              {message.isImportant && (
                <Badge variant="default">Importante</Badge>
              )}
              {message.flags.includes('\\Flagged') && (
                <Badge variant="warning">Contrassegnato</Badge>
              )}
            </div>
          </div>
          <div className="text-sm text-dark-textMuted">
            {format(message.date, "d MMMM yyyy, HH:mm", { locale: it })}
          </div>
        </div>

        {/* Sender info */}
        <div className="flex items-start gap-3">
          <Avatar
            src={undefined}
            fallback={senderName}
            size="md"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-white">{senderName}</p>
              <span className="text-xs text-dark-textMuted">&lt;{message.from.address}&gt;</span>
            </div>
            <div className="text-xs text-dark-textMuted space-y-1">
              <p>A: {toAddresses}</p>
              {ccAddresses && <p>Cc: {ccAddresses}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {message.attachments.length > 0 && (
          <div className="mb-4 p-3 bg-dark-surface rounded-lg border border-dark-border">
            <div className="flex items-center gap-2 mb-2">
              <Paperclip className="h-4 w-4 text-dark-textMuted" />
              <span className="text-sm font-medium text-white">Allegati ({message.attachments.length})</span>
            </div>
            <div className="space-y-2">
              {message.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-dark-bg rounded border border-dark-border"
                >
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-3 w-3 text-dark-textMuted" />
                    <span className="text-sm text-dark-textMuted">{att.filename}</span>
                    <span className="text-xs text-dark-textMuted">
                      ({(att.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Email body */}
        <div className="prose prose-invert max-w-none">
          {message.html ? (
            <div
              dangerouslySetInnerHTML={{ __html: message.html }}
              className="text-white"
            />
          ) : (
            <pre className="whitespace-pre-wrap text-white font-sans">
              {message.text || '(Nessun contenuto)'}
            </pre>
          )}
        </div>
      </div>

      {/* Spacer per il floating menu */}
      <div className="h-24" />
    </div>
  );
};

