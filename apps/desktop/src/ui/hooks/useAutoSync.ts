/**
 * Hook per la sincronizzazione automatica periodica
 */

import { useEffect, useRef } from 'react';
import { useMailStore } from '../store/useMailStore';
import { useSyncMessages } from './useMessages';

/**
 * Avvia la sincronizzazione automatica periodica
 * @param intervalMinutes Intervallo in minuti tra le sincronizzazioni (default: 5)
 */
export const useAutoSync = (intervalMinutes: number = 5) => {
  const { currentAccountId, settings } = useMailStore();
  const { mutate: syncMessages } = useSyncMessages();
  const hasSyncedRef = useRef(false);
  const syncMessagesRef = useRef(syncMessages);

  // Aggiorna il ref quando cambia la funzione mutate
  useEffect(() => {
    syncMessagesRef.current = syncMessages;
  }, [syncMessages]);

  useEffect(() => {
    // Reset il flag quando cambia l'account o l'intervallo
    hasSyncedRef.current = false;
  }, [currentAccountId, intervalMinutes]);

  useEffect(() => {
    // Non sincronizzare se:
    // - Non c'è un account selezionato
    // - La sincronizzazione automatica è disabilitata
    // - Un logout è in corso
    const currentState = useMailStore.getState();
    if (!currentAccountId || !settings.autoSync || currentState.isLoggingOut) {
      console.log('[AutoSync] Sincronizzazione disabilitata:', { 
        currentAccountId, 
        autoSync: settings.autoSync,
        isLoggingOut: currentState.isLoggingOut,
      });
      // Reset il flag quando l'auto-sync viene disabilitato
      hasSyncedRef.current = false;
      return;
    }

    console.log('[AutoSync] Configurazione auto-sync:', {
      currentAccountId,
      intervalMinutes,
      autoSync: settings.autoSync,
      hasSynced: hasSyncedRef.current,
      isLoggingOut: currentState.isLoggingOut,
    });

    // Sincronizza immediatamente al mount solo una volta
    if (!hasSyncedRef.current) {
      // Verifica di nuovo prima di sincronizzare
      const stateBeforeSync = useMailStore.getState();
      if (!stateBeforeSync.currentAccountId || stateBeforeSync.isLoggingOut) {
        console.log('[AutoSync] Account non più valido o logout in corso, annullo sincronizzazione iniziale');
        return;
      }
      console.log('[AutoSync] Sincronizzazione iniziale per account:', currentAccountId);
      syncMessagesRef.current();
      hasSyncedRef.current = true;
    }

    // Imposta l'intervallo per sincronizzazioni periodiche
    // Nota: non includiamo isSyncing nelle dipendenze per evitare loop
    const interval = setInterval(() => {
      // Verifica che l'account sia ancora valido prima di sincronizzare
      const stateBeforeSync = useMailStore.getState();
      if (!stateBeforeSync.currentAccountId || !stateBeforeSync.settings.autoSync || stateBeforeSync.isLoggingOut) {
        console.log('[AutoSync] Sincronizzazione saltata:', {
          hasAccount: !!stateBeforeSync.currentAccountId,
          autoSync: stateBeforeSync.settings.autoSync,
          isLoggingOut: stateBeforeSync.isLoggingOut,
        });
        return;
      }
      // Usa syncMessagesRef per evitare dipendenze che cambiano
      console.log(`[AutoSync] Sincronizzazione automatica (ogni ${intervalMinutes} minuti) per account:`, stateBeforeSync.currentAccountId);
      syncMessagesRef.current();
    }, intervalMinutes * 60 * 1000);

    return () => {
      console.log('[AutoSync] Pulizia intervallo per account:', currentAccountId);
      clearInterval(interval);
      hasSyncedRef.current = false; // Reset anche quando viene pulito
    };
  }, [currentAccountId, settings.autoSync, intervalMinutes]);
};

