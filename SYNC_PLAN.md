# Piano di Implementazione Sincronizzazione Email

## Stato Attuale

### ✅ Implementato
- **OAuth2 Authentication**: Autenticazione con Gmail e Outlook funzionante
- **Storage Locale**: Database SQLite con Drizzle ORM per salvare account, cartelle e messaggi
- **UI Components**: Interfaccia completa per visualizzare messaggi, cartelle, account
- **React Query Hooks**: Hook per gestire query e mutazioni
- **Mock Data**: Funzioni mock per testare l'UI

### ❌ Da Implementare
- **IMAP Client**: Attualmente mock, deve essere implementato come comando Tauri Rust
- **SMTP Client**: Attualmente mock, deve essere implementato come comando Tauri Rust
- **Token Refresh**: Refresh automatico dei token OAuth2 prima della scadenza
- **Sincronizzazione Automatica**: Sincronizzazione periodica in background
- **Sincronizzazione Incrementale**: Solo nuovi messaggi invece di tutti
- **Sincronizzazione Bidirezionale**: Aggiornamenti dal client al server (marcare come letto, spostare, eliminare)
- **Gestione Errori**: Retry logic, gestione offline, notifiche errori
- **IMAP IDLE**: Notifiche push per nuovi messaggi (opzionale)

---

## 1. Implementazione IMAP Client (Rust/Tauri)

### File: `apps/desktop/src-tauri/src/commands/imap.rs`

**Funzionalità da implementare:**
- Connessione IMAP con OAuth2
- Lista cartelle (`LIST` command)
- Fetch messaggi (`FETCH` command)
- Sincronizzazione incrementale usando `UID SEARCH` con `SINCE`
- Parsing MIME con `mailparse` crate
- Gestione flags IMAP (`\Seen`, `\Flagged`, `\Deleted`, ecc.)

**Comandi Tauri da creare:**
```rust
#[tauri::command]
async fn sync_folders(account_id: String) -> Result<Vec<MailFolder>, String>

#[tauri::command]
async fn sync_messages(
    account_id: String,
    folder_path: String,
    since: Option<i64> // timestamp opzionale
) -> Result<Vec<MailMessage>, String>

#[tauri::command]
async fn mark_message_read(
    account_id: String,
    folder_path: String,
    uid: u32,
    read: bool
) -> Result<(), String>

#[tauri::command]
async fn move_message(
    account_id: String,
    folder_path: String,
    uid: u32,
    target_folder: String
) -> Result<(), String>

#[tauri::command]
async fn delete_message(
    account_id: String,
    folder_path: String,
    uid: u32
) -> Result<(), String>
```

**Dipendenze Rust necessarie:**
- `async-imap` o `imap` per client IMAP
- `mailparse` per parsing MIME
- `oauth2` per autenticazione OAuth2
- `tokio` per async runtime

---

## 2. Implementazione SMTP Client (Rust/Tauri)

### File: `apps/desktop/src-tauri/src/commands/smtp.rs`

**Funzionalità da implementare:**
- Connessione SMTP con OAuth2
- Invio email con supporto allegati
- Supporto HTML e plain text
- Gestione errori di invio

**Comandi Tauri da creare:**
```rust
#[tauri::command]
async fn send_email(
    account_id: String,
    to: Vec<String>,
    cc: Option<Vec<String>>,
    bcc: Option<Vec<String>>,
    subject: String,
    body_html: Option<String>,
    body_text: Option<String>,
    attachments: Option<Vec<Attachment>>
) -> Result<(), String>
```

**Dipendenze Rust necessarie:**
- `lettre` per client SMTP
- `oauth2` per autenticazione OAuth2
- `tokio` per async runtime

---

## 3. Token Refresh Automatico

### File: `packages/core/src/auth/token-refresh.ts`

**Funzionalità:**
- Controllo scadenza token prima di ogni richiesta
- Refresh automatico se il token scade tra meno di 5 minuti
- Salvataggio nuovi token nello storage
- Gestione errori di refresh (richiedere nuovo login)

**Implementazione:**
```typescript
export const ensureValidToken = async (account: Account): Promise<string> => {
  const now = Date.now();
  const expiresAt = account.tokens.expiresAt;
  const timeUntilExpiry = expiresAt - now;
  
  // Refresh se scade tra meno di 5 minuti
  if (timeUntilExpiry < 5 * 60 * 1000) {
    const newTokens = await refreshAccessToken(account.provider, account.tokens.refreshToken);
    await accountStorage.updateTokens(account.id, newTokens);
    return newTokens.accessToken;
  }
  
  return account.tokens.accessToken;
};
```

**Hook React:**
```typescript
// apps/desktop/src/ui/hooks/useTokenRefresh.ts
export const useTokenRefresh = () => {
  // Intercetta tutte le chiamate IMAP/SMTP e refresh token se necessario
};
```

---

## 4. Sincronizzazione Automatica Periodica

### File: `apps/desktop/src/ui/hooks/useAutoSync.ts`

**Funzionalità:**
- Sincronizzazione automatica ogni X minuti (configurabile)
- Sincronizzazione solo quando l'app è attiva
- Indicatore di stato di sincronizzazione
- Pausa durante sincronizzazione manuale

**Implementazione:**
```typescript
export const useAutoSync = (intervalMinutes: number = 5) => {
  const { currentAccountId, accounts } = useMailStore();
  const syncMessages = useSyncMessages();
  
  useEffect(() => {
    if (!currentAccountId) return;
    
    const interval = setInterval(() => {
      syncMessages.mutate();
    }, intervalMinutes * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [currentAccountId, intervalMinutes]);
};
```

**Integrazione in App.tsx:**
```typescript
// Avvia sincronizzazione automatica
useAutoSync(settings.syncInterval);
```

---

## 5. Sincronizzazione Incrementale

### Modifiche a `packages/core/src/imap/imap.ts` (Rust)

**Funzionalità:**
- Usare `UID SEARCH SINCE <date>` invece di fetchare tutti i messaggi
- Salvare `lastSyncAt` per ogni cartella
- Fetchare solo messaggi nuovi o modificati

**Implementazione:**
```rust
// In sync_messages command
let since = since.unwrap_or_else(|| {
    // Ottieni lastSyncAt dalla cartella nel database
    get_folder_last_sync(account_id, folder_path)
});

let search_query = format!("SINCE {}", format_date(since));
let uids = client.uid_search(search_query).await?;

// Fetch solo i nuovi UID
for uid in uids {
    let message = client.uid_fetch(uid, "RFC822").await?;
    // Parse e salva
}
```

**Modifiche al database:**
- Aggiungere campo `lastSyncAt` alla tabella `folders`
- Aggiornare dopo ogni sincronizzazione

---

## 6. Sincronizzazione Bidirezionale

### Comandi Tauri aggiuntivi

**Marca come letto/non letto:**
```rust
#[tauri::command]
async fn mark_message_read(
    account_id: String,
    folder_path: String,
    uid: u32,
    read: bool
) -> Result<(), String> {
    // 1. Aggiorna flag sul server IMAP
    // 2. Aggiorna nel database locale
    // 3. Emetti evento per aggiornare UI
}
```

**Sposta messaggio:**
```rust
#[tauri::command]
async fn move_message(
    account_id: String,
    folder_path: String,
    uid: u32,
    target_folder: String
) -> Result<(), String> {
    // 1. COPY messaggio su server
    // 2. DELETE messaggio dalla cartella originale
    // 3. Aggiorna database locale
}
```

**Elimina messaggio:**
```rust
#[tauri::command]
async fn delete_message(
    account_id: String,
    folder_path: String,
    uid: u32
) -> Result<(), String> {
    // 1. Marca come \Deleted sul server
    // 2. EXPUNGE se necessario
    // 3. Rimuovi dal database locale
}
```

**Hook React:**
```typescript
// apps/desktop/src/ui/hooks/useMessageActions.ts
export const useMarkAsRead = () => {
  return useMutation({
    mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
      // Chiama comando Tauri
      await invoke('mark_message_read', { accountId, folderPath, uid, read });
      // Aggiorna storage locale
      await messageStorage.markAsRead(id, read);
    },
  });
};
```

---

## 7. Gestione Errori e Retry Logic

### File: `packages/core/src/utils/retry.ts`

**Funzionalità:**
- Retry automatico con exponential backoff
- Gestione errori di connessione
- Notifiche errori all'utente
- Modalità offline

**Implementazione:**
```typescript
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
};
```

**Integrazione:**
- Usare `withRetry` per tutte le chiamate IMAP/SMTP
- Mostrare notifiche errori con `tauri-plugin-notification`
- Salvare operazioni fallite per retry successivo

---

## 8. Sincronizzazione Iniziale al Login

### Modifiche a `apps/desktop/src/ui/components/AccountMenu.tsx`

**Dopo aggiunta account:**
```typescript
const handleAddAccount = async (provider: AccountProvider) => {
  // ... OAuth flow ...
  
  // Dopo salvataggio account
  await addAccountMutation.mutateAsync(account);
  setCurrentAccount(account.id);
  
  // Sincronizza immediatamente
  const syncMutation = useSyncMessages();
  await syncMutation.mutateAsync();
};
```

---

## 9. Indicatori di Stato

### Componente: `apps/desktop/src/ui/components/SyncStatus.tsx`

**Funzionalità:**
- Indicatore visivo di sincronizzazione in corso
- Ultima sincronizzazione completata
- Errori di sincronizzazione
- Stato connessione

**Implementazione:**
```typescript
export const SyncStatus: React.FC = () => {
  const { isPending, lastSyncAt, lastError } = useSyncStatus();
  
  return (
    <div className="sync-status">
      {isPending && <Spinner />}
      {lastSyncAt && <span>Last sync: {formatTime(lastSyncAt)}</span>}
      {lastError && <ErrorIcon />}
    </div>
  );
};
```

---

## 10. Priorità di Implementazione

### Fase 1: Fondamentale
1. ✅ Token refresh automatico
2. ✅ IMAP client Rust (sync_folders, sync_messages)
3. ✅ SMTP client Rust (send_email)
4. ✅ Sincronizzazione iniziale al login

### Fase 2: Miglioramenti
5. ✅ Sincronizzazione automatica periodica
6. ✅ Sincronizzazione incrementale
7. ✅ Sincronizzazione bidirezionale (mark as read, delete, move)

### Fase 3: Robustezza
8. ✅ Gestione errori e retry logic
9. ✅ Indicatori di stato
10. ✅ Modalità offline

### Fase 4: Avanzato (Opzionale)
11. IMAP IDLE per notifiche push
12. Sincronizzazione selettiva (solo cartelle importanti)
13. Compressione dati per storage locale

---

## Note Tecniche

### OAuth2 per IMAP/SMTP
- Gmail: Usa XOAUTH2 con access token
- Outlook: Usa XOAUTH2 con access token
- Token devono essere refreshati prima della scadenza

### Database Schema
- Aggiungere `lastSyncAt` a `folders` table
- Aggiungere `syncedAt` a `messages` table (già presente)
- Aggiungere `serverUid` per mapping con server IMAP

### Performance
- Batch operations per multiple messages
- Lazy loading per messaggi vecchi
- Index su `folderId`, `accountId`, `syncedAt` nel database

### Sicurezza
- Token OAuth2 crittografati nello storage
- Nessun token in plain text
- Validazione input su tutti i comandi Tauri

