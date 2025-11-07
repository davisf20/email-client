# 🔐 Guida Setup Google OAuth2 - Nuova Interfaccia

## Dove trovare la configurazione degli scope

Vedo che stai usando la nuova interfaccia **Google Auth Platform**. Ecco come configurare gli scope:

### Passo 1: Accedi alla configurazione OAuth

1. Dalla pagina **"Google Auth Platform / Overview"** che vedi:
   - Nel menu laterale sinistro, clicca su **"Audience"** 
   - Oppure cerca **"OAuth consent screen"** nel menu

### Passo 2: Se non trovi "Audience"

Prova questi percorsi alternativi:

**Opzione A - Menu laterale:**
- Cerca nel menu laterale una voce chiamata:
  - **"OAuth consent screen"**
  - **"Consent screen"**
  - **"App configuration"**

**Opzione B - URL diretto:**
- Vai direttamente a: https://console.cloud.google.com/apis/credentials/consent
- Seleziona il tuo progetto se richiesto

**Opzione C - Menu classico:**
- Nel menu principale (☰ in alto a sinistra)
- Cerca **"APIs & Services"**
- Poi **"OAuth consent screen"**

### Passo 3: Configura gli scope

Una volta nella pagina di configurazione:

1. Se vedi un pulsante **"Edit"** o **"Configure"**, cliccalo
2. Cerca la sezione **"Scopes"** o **"API Scopes"**
3. Clicca su **"Add or Remove Scopes"** o **"Add Scopes"**
4. Nella finestra che si apre:
   - **Cerca** nella barra di ricerca: `gmail`
   - **Seleziona**: `https://mail.google.com/`
   - **Cerca**: `userinfo.email`
   - **Seleziona**: `https://www.googleapis.com/auth/userinfo.email`
   - **Cerca**: `userinfo.profile`
   - **Seleziona**: `https://www.googleapis.com/auth/userinfo.profile`
5. Clicca **"Update"** o **"Save"**
6. Salva tutte le modifiche

### Passo 4: Aggiungi Test Users

1. Nella stessa pagina, cerca la sezione **"Test users"**
2. Clicca **"+ ADD USERS"**
3. Aggiungi: `davisfusco06@gmail.com`
4. Clicca **"ADD"** e salva

### Se ancora non trovi la sezione

Prova questo:

1. Vai su: https://console.cloud.google.com/apis/credentials
2. Clicca su **"OAuth 2.0 Client IDs"** nella lista
3. Clicca sul tuo client OAuth (es. "Mail Client Desktop")
4. Verifica che il redirect URI sia: `http://localhost:1420`
5. Per gli scope, devi tornare alla **"OAuth consent screen"**

### Link utili diretti:

- **OAuth Consent Screen**: https://console.cloud.google.com/apis/credentials/consent
- **Credentials**: https://console.cloud.google.com/apis/credentials
- **Google Auth Platform**: https://console.cloud.google.com/apis/credentials/consent

### Scope da aggiungere (copia e incolla):

```
https://mail.google.com/
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

