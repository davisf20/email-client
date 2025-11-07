/**
 * Pagina di callback OAuth2 per intercettare il redirect
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    console.log('[OAuth Callback]', { code, error, errorDescription, hasOpener: !!window.opener });
    
    if (error) {
      setStatus('error');
      const errorMsg = errorDescription || error;
      
      // Invia l'errore alla finestra principale
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: 'oauth-error', error: errorMsg }, '*');
          console.log('[OAuth Callback] Errore inviato alla finestra principale:', errorMsg);
        } catch (err) {
          console.error('[OAuth Callback] Errore nell\'invio del messaggio:', err);
        }
      } else {
        console.warn('[OAuth Callback] window.opener non disponibile o chiuso');
      }
      
      // Chiudi dopo un delay
      setTimeout(() => {
        if (window.opener) {
          window.close();
        }
      }, 3000);
      return;
    }

    if (code) {
      setStatus('success');
      
      // Invia il codice alla finestra principale
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: 'oauth-code', code }, '*');
          console.log('[OAuth Callback] Codice inviato alla finestra principale');
        } catch (err) {
          console.error('[OAuth Callback] Errore nell\'invio del codice:', err);
          setStatus('error');
          return;
        }
      } else {
        console.warn('[OAuth Callback] window.opener non disponibile o chiuso');
        setStatus('error');
        return;
      }
      
      // Chiudi questa finestra dopo un breve delay
      setTimeout(() => {
        if (window.opener) {
          window.close();
        }
      }, 1000);
    } else if (!error) {
      // Nessun codice né errore - potrebbe essere un problema
      console.warn('[OAuth Callback] Nessun codice né errore trovato nei parametri');
      setStatus('error');
      setTimeout(() => {
        if (window.opener) {
          window.opener.postMessage({ type: 'oauth-error', error: 'Nessun codice di autorizzazione ricevuto' }, '*');
          window.close();
        }
      }, 2000);
    }
  }, [code, error, errorDescription]);

  return (
    <div className="flex items-center justify-center h-screen bg-dark-bg">
      <div className="text-center p-8">
        {status === 'error' ? (
          <>
            <h1 className="text-xl font-bold text-red-500 mb-2">Errore di autorizzazione</h1>
            <p className="text-dark-textMuted mb-4">{errorDescription || error || 'Errore sconosciuto'}</p>
            <p className="text-sm text-dark-textMuted">Questa finestra si chiuderà automaticamente...</p>
          </>
        ) : status === 'success' ? (
          <>
            <h1 className="text-xl font-bold text-green-500 mb-2">Autorizzazione completata!</h1>
            <p className="text-dark-textMuted">Stai per essere reindirizzato...</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white mb-2">Attendere...</h1>
            <p className="text-dark-textMuted">Elaborazione dell'autorizzazione...</p>
          </>
        )}
      </div>
    </div>
  );
};

