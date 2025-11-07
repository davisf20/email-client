# 🔧 Fix Redirect URI Mismatch

## Errore: `redirect_uri_mismatch`

Questo errore significa che il redirect URI nel codice non corrisponde a quello configurato in Google Cloud Console.

## Soluzione

### Passo 1: Verifica il Redirect URI nel codice

Il codice usa: `http://localhost:1420/oauth/callback`

### Passo 2: Aggiorna Google Cloud Console

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Seleziona il tuo progetto
3. Menu: **"APIs & Services"** → **"Credentials"**
4. Clicca sul tuo **OAuth 2.0 Client ID** (quello che stai usando)
5. Nella sezione **"Authorized redirect URIs"**, verifica che ci sia:
   ```
   http://localhost:1420/oauth/callback
   ```
6. Se non c'è, clicca **"+ ADD URI"** e aggiungilo
7. **IMPORTANTE**: Rimuovi eventuali redirect URI vecchi come:
   - `http://localhost:1420` (senza `/oauth/callback`)
8. Clicca **"SAVE"**

### Passo 3: Verifica che corrisponda esattamente

Il redirect URI deve corrispondere **ESATTAMENTE**, incluso:
- ✅ `http://` (non `https://`)
- ✅ `localhost` (non `127.0.0.1`)
- ✅ Porta `1420`
- ✅ Path `/oauth/callback`

### Passo 4: Riavvia il server

Dopo aver salvato le modifiche in Google Cloud Console:
1. Riavvia il server di sviluppo
2. Prova di nuovo ad aggiungere l'account

## Debug

Se l'errore persiste, controlla la console del browser per vedere quale redirect URI viene effettivamente usato. Dovresti vedere un log `[OAuth Debug]` che mostra il `redirectUri`.

## Note

- Le modifiche in Google Cloud Console possono richiedere qualche secondo per propagarsi
- Assicurati di aver salvato le modifiche prima di riprovare
- Se hai più OAuth Client ID, verifica di modificare quello corretto

