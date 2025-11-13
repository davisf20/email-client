/**
 * Componente ComposeModal per comporre nuove email
 */

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Paperclip, Send } from 'lucide-react';
import { useMailStore } from '../store/useMailStore';
import { Button, Input, cn } from '@mail-client/ui-kit';
import { sendEmail } from '@mail-client/core';

export const ComposeModal: React.FC = () => {
  const { isComposeOpen, setComposeOpen, currentAccountId, accounts, composeData } = useMailStore();
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Carica i dati di compose quando il modal si apre
  useEffect(() => {
    if (isComposeOpen && composeData) {
      setTo(composeData.to || '');
      setCc(composeData.cc || '');
      setBcc(composeData.bcc || '');
      setSubject(composeData.subject || '');
      setBody(composeData.body || '');
    } else if (!isComposeOpen) {
      // Reset quando si chiude
      setTo('');
      setCc('');
      setBcc('');
      setSubject('');
      setBody('');
    }
  }, [isComposeOpen, composeData]);

  const handleSend = async () => {
    if (!currentAccountId) {
      alert('Please select an account first');
      return;
    }

    const account = accounts.find((a) => a.id === currentAccountId);
    if (!account) {
      alert('Account not found');
      return;
    }

    if (!to.trim()) {
      alert('Please enter a recipient');
      return;
    }

    setIsSending(true);
    try {
      await sendEmail(account, {
        to: to.split(',').map((addr) => addr.trim()),
        cc: cc ? cc.split(',').map((addr) => addr.trim()) : undefined,
        bcc: bcc ? bcc.split(',').map((addr) => addr.trim()) : undefined,
        subject: subject.trim(),
        text: body.trim(),
        html: body.trim().replace(/\n/g, '<br>'),
      });

      // Reset form
      setTo('');
      setCc('');
      setBcc('');
      setSubject('');
      setBody('');
      setComposeOpen(false);
    } catch (error) {
      console.error('Error sending email:', error);
      alert(`Error sending email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog.Root open={isComposeOpen} onOpenChange={setComposeOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className={cn(
          'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-[90vw] max-w-2xl h-[80vh]',
          'bg-dark-surface border border-dark-border rounded-xl shadow-xl',
          'flex flex-col z-50'
        )}>
          <div className="flex items-center justify-between p-4 border-b border-dark-border">
            <Dialog.Title className="text-lg font-semibold text-white">
              New Message
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-dark-textMuted hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-textMuted mb-1">
                A
              </label>
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="destinatario@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-textMuted mb-1">
                Cc
              </label>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-textMuted mb-1">
                Ccn
              </label>
              <Input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="bcc@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-textMuted mb-1">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Message subject"
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-dark-textMuted mb-1">
                Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
                className={cn(
                  'w-full h-full min-h-[300px]',
                  'rounded-lg border border-dark-border bg-dark-bg/50',
                  'px-3 py-2 text-sm text-white',
                  'placeholder:text-dark-textMuted',
                  'focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent'
                )}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-t border-dark-border">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setComposeOpen(false)}>
                Cancel
              </Button>
                  <Button onClick={handleSend} disabled={isSending}>
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? 'Sending...' : 'Send'}
                  </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

