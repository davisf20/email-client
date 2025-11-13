/**
 * Modal per inserire l'URL di redirect OAuth
 */

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button, Input, cn } from '@mail-client/ui-kit';

interface OAuthUrlInputModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
  provider: 'gmail' | 'outlook';
}

export const OAuthUrlInputModal: React.FC<OAuthUrlInputModalProps> = ({
  open,
  onClose,
  onSubmit,
  provider,
}) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!url.trim()) {
      setError('Inserisci un URL valido');
      return;
    }

    try {
      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get('code');
      
      if (!code) {
        setError('URL non valido: codice di autorizzazione non trovato. Assicurati di copiare l\'URL completo dalla barra degli indirizzi.');
        return;
      }

      setError(null);
      onSubmit(url);
      setUrl('');
    } catch (err) {
      setError(`URL non valido: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setUrl('');
      setError(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-[90vw] max-w-lg',
            'bg-white border border-black/10 rounded-2xl shadow-xl',
            'p-6 z-50'
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-xl font-semibold text-black">
              Complete OAuth Login
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-1 rounded-full hover:bg-black/5 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-black" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-black/70 mb-4">
            After completing the login in your browser, you will be redirected to a page.
            <br />
            <strong>Copy the entire URL from your browser's address bar</strong> and paste it below:
          </Dialog.Description>

          <div className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Paste the redirect URL here..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmit();
                  }
                }}
                className={cn(
                  'w-full',
                  error && 'border-red-500 focus:border-red-500'
                )}
              />
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-black hover:bg-black/5"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!url.trim()}
                className="bg-black text-white hover:bg-black/90"
              >
                Continue
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

