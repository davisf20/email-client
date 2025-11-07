# 📧 Mail Client Desktop

Client email desktop cross-platform per Windows e macOS costruito con Tauri, React e TypeScript.

## 🚀 Caratteristiche

- ✅ OAuth2 authentication (Gmail + Outlook)
- ✅ IMAP/SMTP sync
- ✅ Storage locale con SQLite
- ✅ Notifiche desktop
- ✅ Supporto multi-account
- ✅ Interfaccia moderna e responsive
- ✅ Funziona completamente offline

## 🛠️ Stack Tecnologico

- **Desktop**: Tauri + Rust
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + Radix UI
- **State**: Zustand + React Query
- **Mail**: IMAPFlow + Nodemailer
- **Database**: SQLite + Drizzle ORM

## 📦 Struttura Monorepo

```
mail-client/
├── apps/
│   └── desktop/          # App Tauri principale
├── packages/
│   ├── core/             # Logica mail (IMAP, SMTP, storage)
│   └── ui-kit/           # Componenti UI riutilizzabili
```

## 🏗️ Prerequisiti

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Rust (per Tauri) - installa da [rustup.rs](https://rustup.rs/)
- Sistema di build per Rust (Cargo) - incluso con Rust

**Nota**: Assicurati che Cargo sia nel tuo PATH. Se Rust è installato ma Cargo non è trovato, aggiungi questa riga al tuo `~/.zshrc` o `~/.bash_profile`:

```bash
export PATH="$HOME/.cargo/bin:$PATH"
```

## 🔧 Configurazione

### 1. Installa le dipendenze

```bash
pnpm install
```

### 2. Configura OAuth2

Crea un file `.env` nella root del progetto con le tue credenziali OAuth2. **Importante**: In Vite, le variabili d'ambiente devono avere il prefisso `VITE_` per essere accessibili nel browser:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_CLIENT_SECRET=your_google_client_secret
VITE_OUTLOOK_CLIENT_ID=your_outlook_client_id
VITE_OUTLOOK_CLIENT_SECRET=your_outlook_client_secret
```

#### Google OAuth2 Setup - Guida Completa

**Passo 1: Crea o seleziona un progetto**

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Se non hai un progetto, clicca su "Select a project" → "New Project"
3. Inserisci un nome (es. "email-client") e clicca "Create"
4. Seleziona il progetto appena creato

**Passo 2: Abilita l'API Gmail**

1. Nel menu laterale, vai su **"APIs & Services"** → **"Library"**
2. Cerca "Gmail API" nella barra di ricerca
3. Clicca su "Gmail API" e poi su **"Enable"**

**Passo 3: Configura OAuth Consent Screen**

1. Nel menu laterale, vai su **"APIs & Services"** → **"OAuth consent screen"**
2. Seleziona **"External"** (per sviluppo) e clicca "Create"
3. Compila i campi obbligatori:
   - **App name**: "Mail Client" (o il nome che preferisci)
   - **User support email**: la tua email
   - **Developer contact information**: la tua email
4. Clicca "Save and Continue"
5. **IMPORTANTE - Configurazione Scopes:**
   - Nella schermata "Scopes", clicca **"Add or Remove Scopes"**
   - Nella finestra che si apre, vedrai due colonne:
     - **Left column**: Scope disponibili
     - **Right column**: Scope selezionati
   - Cerca e seleziona questi scope uno per uno:
     - Cerca `gmail` e seleziona: **`https://mail.google.com/`** (Gmail API)
     - Cerca `userinfo.email` e seleziona: **`https://www.googleapis.com/auth/userinfo.email`** (Userinfo Email)
     - Cerca `userinfo.profile` e seleziona: **`https://www.googleapis.com/auth/userinfo.profile`** (Userinfo Profile)
   - Oppure inserisci manualmente gli scope nella barra di ricerca in alto
   - Clicca **"Update"** per confermare
   - Clicca **"Save and Continue"**
6. Nella schermata "Test users":
   - Clicca **"+ ADD USERS"**
   - Aggiungi la tua email (es. `davisfusco06@gmail.com`)
   - Clicca **"ADD"**
   - Clicca **"Save and Continue"**
7. Rivedi le informazioni e clicca **"Back to Dashboard"**

**Passo 4: Crea le credenziali OAuth 2.0**

1. Nel menu laterale, vai su **"APIs & Services"** → **"Credentials"**
2. Clicca su **"+ Create credentials"** → **"OAuth client ID"**
3. Se richiesto, configura prima l'OAuth consent screen (se non l'hai già fatto)
4. Seleziona **"Application type"**: **"Web application"**
5. Inserisci un **"Name"** (es. "Mail Client Desktop")
6. In **"Authorized redirect URIs"**, aggiungi:
   - `http://localhost:1420`
   - `http://localhost:1420/oauth/callback` (opzionale, per gestione redirect)
7. Clicca **"Create"**
8. **IMPORTANTE**: Copia immediatamente:
   - **Client ID** (es. `123456789-abcdefghijklmnop.apps.googleusercontent.com`)
   - **Client Secret** (es. `GOCSPX-abcdefghijklmnopqrstuvwxyz`)
   - ⚠️ Il Client Secret viene mostrato solo una volta!

**Passo 5: Configura il file .env**

1. Apri il file `.env` nella root del progetto
2. Aggiungi le credenziali:
   ```env
   VITE_GOOGLE_CLIENT_ID=il_tuo_client_id_qui
   VITE_GOOGLE_CLIENT_SECRET=il_tuo_client_secret_qui
   ```
3. Salva il file
4. **Riavvia il server di sviluppo** per caricare le nuove variabili

**Note importanti:**

- Le credenziali OAuth 2.0 sono valide solo per l'app in modalità "Test"
- Per pubblicare l'app, devi richiedere la verifica di Google
- Il redirect URI deve corrispondere esattamente a quello configurato
- Se perdi il Client Secret, devi crearne uno nuovo

#### Outlook OAuth2 Setup

1. Vai su [Azure Portal](https://portal.azure.com/)
2. Registra una nuova applicazione
3. Configura le autorizzazioni API:
   - `IMAP.AccessAsUser.All`
   - `SMTP.Send`
   - `User.Read`
4. Aggiungi `http://localhost:1420` come URI di reindirizzamento
5. Copia Application (client) ID e Secret nel file `.env`

## 🏃 Sviluppo

```bash
# Avvia in modalità sviluppo
pnpm tauri:dev

# Build per produzione
pnpm tauri:build

# Build solo frontend
pnpm --filter desktop dev

# Build solo core package
pnpm --filter @mail-client/core build
```

## 📝 Note

- Il database SQLite viene creato automaticamente nella directory dati dell'applicazione
- I token OAuth vengono crittografati e salvati localmente
- L'applicazione funziona completamente offline dopo la sincronizzazione iniziale

## 🐛 Troubleshooting

### Errore di build Rust

Assicurati di avere Rust installato:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Errore OAuth2

Verifica che le credenziali nel file `.env` siano corrette e che gli URI di reindirizzamento siano configurati correttamente nei provider OAuth2.

## 📝 Licenza

MIT
