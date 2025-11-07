# 🔐 Guida Completa Setup OAuth2

## Google OAuth2 - Configurazione Scopes

### Dove configurare gli scope nella nuova Google Auth Platform:

**Metodo 1 - Tramite Google Auth Platform (Nuova Interfaccia):**

1. **Vai alla Google Auth Platform:**
   - [Google Cloud Console](https://console.cloud.google.com/)
   - Seleziona il tuo progetto
   - Nel menu laterale, cerca **"Google Auth Platform"** o vai direttamente a:
   - [Google Auth Platform](https://console.cloud.google.com/apis/credentials/consent)

2. **Configura gli scope:**
   - Nel menu laterale della Google Auth Platform, clicca su **"Audience"** o **"OAuth consent screen"**
   - Se vedi una schermata di overview, cerca un pulsante **"Configure"** o **"Edit"**
   - Vai alla sezione **"Scopes"** o **"API Scopes"**
   - Clicca su **"ADD OR REMOVE SCOPES"** o **"Add Scopes"**

**Metodo 2 - Tramite il menu classico (se disponibile):**

1. **Vai alla OAuth Consent Screen (metodo classico):**
   - [Google Cloud Console](https://console.cloud.google.com/)
   - Seleziona il tuo progetto
   - Menu laterale: **"APIs & Services"** → **"OAuth consent screen"**
   - Se non vedi questa opzione, usa il metodo 1 sopra

2. **Aggiungi gli scope:**
   - Se stai creando l'app per la prima volta, segui il wizard
   - Se l'app esiste già, clicca su **"EDIT APP"** o **"Configure"**
   - Vai alla sezione **"Scopes"**
   - Clicca su **"ADD OR REMOVE SCOPES"**

3. **Seleziona gli scope necessari:**
   
   **Metodo 1 - Ricerca manuale:**
   - Nella finestra "Add scopes", usa la barra di ricerca
   - Cerca e seleziona:
     - `https://mail.google.com/` (Gmail API - accesso completo alle email)
     - `https://www.googleapis.com/auth/userinfo.email` (Email dell'utente)
     - `https://www.googleapis.com/auth/userinfo.profile` (Profilo dell'utente)
   
   **Metodo 2 - Inserimento diretto:**
   - Clicca su **"Manually add scopes"** in basso
   - Inserisci uno per uno:
     ```
     https://mail.google.com/
     https://www.googleapis.com/auth/userinfo.email
     https://www.googleapis.com/auth/userinfo.profile
     ```
   - Clicca **"Add to table"** per ciascuno

4. **Salva le modifiche:**
   - Clicca **"Update"** nella finestra degli scope
   - Clicca **"Save and Continue"** nella schermata principale

### Scope utilizzati nel codice:

Gli scope sono definiti in `packages/core/src/auth/oauth.ts`:

```typescript
scopes: [
  'https://mail.google.com/',                                    // Accesso completo Gmail
  'https://www.googleapis.com/auth/userinfo.email',             // Email utente
  'https://www.googleapis.com/auth/userinfo.profile',            // Profilo utente
]
```

### Verifica che gli scope siano corretti:

1. Vai su **"OAuth consent screen"**
2. Controlla la sezione **"Scopes"**
3. Dovresti vedere tutti e tre gli scope elencati sopra
4. Se manca qualcuno, aggiungilo seguendo i passi sopra

### Aggiungi utenti di test:

1. Nella stessa pagina **"OAuth consent screen"**
2. Scorri fino a **"Test users"**
3. Clicca **"+ ADD USERS"**
4. Aggiungi gli indirizzi email che devono poter accedere (es. `davisfusco06@gmail.com`)
5. Clicca **"ADD"** e poi **"SAVE"**

### Troubleshooting:

- **Errore 403: access_denied**: Assicurati di aver aggiunto l'email come test user
- **Scope non disponibili**: Verifica che l'API Gmail sia abilitata nel progetto
- **Redirect URI mismatch**: Controlla che `http://localhost:1420` sia esatto nelle credenziali OAuth

## Outlook OAuth2 - Configurazione Scopes

### Dove configurare gli scope in Azure Portal:

1. Vai su [Azure Portal](https://portal.azure.com/)
2. Seleziona **"Azure Active Directory"** → **"App registrations"**
3. Seleziona la tua app (o creane una nuova)
4. Vai su **"API permissions"**
5. Clicca **"+ Add a permission"**
6. Seleziona **"Microsoft Graph"** → **"Delegated permissions"**
7. Cerca e aggiungi:
   - `IMAP.AccessAsUser.All` (Accesso IMAP)
   - `SMTP.Send` (Invio email)
   - `User.Read` (Lettura profilo utente)
8. Clicca **"Add permissions"**
9. **IMPORTANTE**: Clicca **"Grant admin consent"** se necessario

### Scope utilizzati nel codice:

```typescript
scopes: [
  'https://outlook.office.com/IMAP.AccessAsUser.All',  // Accesso IMAP
  'https://outlook.office.com/SMTP.Send',                // Invio SMTP
  'https://graph.microsoft.com/User.Read',                // Profilo utente
]
```

