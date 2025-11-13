use serde::{Deserialize, Serialize};
use async_imap::Session;
use async_imap::Authenticator;
use tokio_native_tls::TlsConnector;
use tokio::net::TcpStream;
use mailparse::*;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};
use futures_util::io::{AsyncRead, AsyncWrite};
use futures_util::StreamExt;
use std::pin::Pin;
use std::task::{Context, Poll};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;

// Wrapper per combinare read e write halves di uno stream TLS
struct CombinedStream {
    read: tokio_util::compat::Compat<tokio::io::ReadHalf<tokio_native_tls::TlsStream<tokio::net::TcpStream>>>,
    write: tokio_util::compat::Compat<tokio::io::WriteHalf<tokio_native_tls::TlsStream<tokio::net::TcpStream>>>,
}

impl AsyncRead for CombinedStream {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut [u8],
    ) -> Poll<std::io::Result<usize>> {
        // futures_util::io::AsyncRead usa &mut [u8], non ReadBuf
        Pin::new(&mut self.read).poll_read(cx, buf)
    }
}

impl AsyncWrite for CombinedStream {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        Pin::new(&mut self.write).poll_write(cx, buf)
    }
    
    fn poll_flush(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.write).poll_flush(cx)
    }
    
    fn poll_close(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.write).poll_close(cx)
    }
}

impl std::fmt::Debug for CombinedStream {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "CombinedStream")
    }
}

impl std::marker::Unpin for CombinedStream {}

// Implementazione Authenticator per XOAUTH2
struct XOAuth2Authenticator {
    encoded: String,
}

impl Authenticator for XOAuth2Authenticator {
    type Response = String;
    
    fn process(&mut self, _challenge: &[u8]) -> Self::Response {
        // Per XOAUTH2, restituiamo direttamente la stringa base64 codificata
        self.encoded.clone()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MailFolder {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub path: String,
    pub unread_count: i32,
    pub total_count: i32,
    pub sync_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MailMessage {
    pub id: String,
    pub account_id: String,
    pub folder_id: String,
    pub uid: u32,
    pub message_id: String,
    pub subject: String,
    pub from_name: Option<String>,
    pub from_address: String,
    pub to_addresses: Vec<String>,
    pub cc_addresses: Option<Vec<String>>,
    pub bcc_addresses: Option<Vec<String>>,
    pub date: i64,
    pub text: Option<String>,
    pub html: Option<String>,
    pub flags: Vec<String>,
    pub is_read: bool,
    pub is_starred: bool,
    pub is_important: bool,
    pub thread_id: Option<String>,
    pub in_reply_to: Option<String>,
    pub references: Option<Vec<String>>,
    pub synced_at: i64,
}

/// Helper per creare connessione IMAP con OAuth2 usando XOAUTH2
async fn create_imap_session(
    provider: &str,
    email: &str,
    access_token: &str,
) -> Result<Session<CombinedStream>, String> {
    let (host, port) = match provider {
        "gmail" => ("imap.gmail.com", 993),
        "outlook" => ("outlook.office365.com", 993),
        _ => return Err(format!("Provider non supportato: {}", provider)),
    };

    let tls = native_tls::TlsConnector::builder()
        .build()
        .map_err(|e| format!("Errore nella creazione del connector TLS: {}", e))?;
    
    let tls = TlsConnector::from(tls);

    let tcp_stream = TcpStream::connect((host, port))
        .await
        .map_err(|e| format!("Errore nella connessione TCP: {}", e))?;

    let tls_stream = tls
        .connect(host, tcp_stream)
        .await
        .map_err(|e| format!("Errore nella connessione TLS: {}", e))?;

    // Converti tokio::io::AsyncRead/AsyncWrite in futures_io::AsyncRead/AsyncWrite usando tokio-util
    // Dividiamo lo stream in read e write halves e li convertiamo separatamente
    let (read_half, write_half) = tokio::io::split(tls_stream);
    let compat_read = read_half.compat();
    let compat_write = write_half.compat_write();
    
    // Combina read e write in un unico stream
    let combined = CombinedStream {
        read: compat_read,
        write: compat_write,
    };
    
    let client = async_imap::Client::new(combined);
    
    // Usa XOAUTH2 per Gmail, fallback a login normale per altri provider
    let session = if provider == "gmail" {
        // Costruisci la stringa XOAUTH2 nel formato richiesto da Gmail
        // Formato: user=email\1auth=Bearer access_token\1\1
        let xoauth2_string = format!("user={}\x01auth=Bearer {}\x01\x01", email, access_token);
        
        // Codifica in base64
        let xoauth2_encoded = BASE64_STANDARD.encode(xoauth2_string.as_bytes());
        
        println!("[IMAP] Tentativo autenticazione XOAUTH2 per Gmail");
        
        // Crea l'authenticator XOAUTH2
        let authenticator = XOAuth2Authenticator {
            encoded: xoauth2_encoded,
        };
        
        // Usa authenticate con XOAUTH2
        let session_result = client
            .authenticate("XOAUTH2", authenticator)
            .await;
        
        match session_result {
            Ok(session) => {
                println!("[IMAP] Autenticazione XOAUTH2 riuscita per Gmail!");
                session
            }
            Err((err, _client)) => {
                println!("[IMAP] ===== ERRORE AUTENTICAZIONE XOAUTH2 =====");
                println!("[IMAP] Errore completo: {:?}", err);
                println!("[IMAP] Email: {}", email);
                println!("[IMAP] Access token length: {} chars", access_token.len());
                println!("[IMAP] Access token preview: {}...", &access_token.chars().take(20).collect::<String>());
                return Err(format!("Errore nell'autenticazione XOAUTH2: {:?}", err));
            }
        }
    } else {
        // Per Outlook, prova prima XOAUTH2
        // Outlook supporta XOAUTH2 ma potrebbe richiedere un formato diverso
        let xoauth2_string = format!("user={}\x01auth=Bearer {}\x01\x01", email, access_token);
        let xoauth2_encoded = BASE64_STANDARD.encode(xoauth2_string.as_bytes());
        
        println!("[IMAP] Tentativo autenticazione XOAUTH2 per Outlook");
        
        // Crea l'authenticator XOAUTH2
        let authenticator = XOAuth2Authenticator {
            encoded: xoauth2_encoded,
        };
        
        // Prova XOAUTH2 per Outlook
        match client.authenticate("XOAUTH2", authenticator).await {
            Ok(session) => session,
            Err(_) => {
                println!("[IMAP] XOAUTH2 fallito per Outlook");
                // Per il fallback, dobbiamo riconnetterci perché il client è stato spostato
                // Per ora restituiamo un errore - in futuro possiamo implementare riconnessione
                return Err("XOAUTH2 fallito per Outlook e login normale non supportato".to_string());
            }
        }
    };

    Ok(session)
}

/// Sincronizza le cartelle di un account IMAP
#[tauri::command]
pub async fn sync_folders(
    account_id: String,
    email: String,
    provider: String,
    access_token: String,
) -> Result<Vec<MailFolder>, String> {
    println!("[IMAP] Sync folders per account: {} ({})", account_id, email);
    
    // Prova a connettere al server IMAP reale
    match create_imap_session(&provider, &email, &access_token).await {
        Ok(mut session) => {
            println!("[IMAP] Sessione IMAP creata con successo, eseguo LIST...");
            // Esegui LIST per ottenere le cartelle
            let result = match session.list(None, Some("*")).await {
                Ok(mut folders_stream) => {
                    println!("[IMAP] LIST eseguito con successo, leggo cartelle...");
                    let mut result = Vec::new();
                    while let Some(folder_result) = folders_stream.next().await {
                        match folder_result {
                            Ok(folder) => {
                                let name = folder.name().to_string();
                                let path = folder.name().to_string();
                                println!("[IMAP] Cartella trovata: {} ({})", name, path);
                                
                                result.push(MailFolder {
                                    id: format!("{}-{}", account_id, name.replace("/", "-").replace(" ", "-")),
                                    account_id: account_id.clone(),
                                    name: name.clone(),
                                    path: path.clone(),
                                    unread_count: 0, // TODO: Ottenere conteggio reale
                                    total_count: 0,  // TODO: Ottenere conteggio reale
                                    sync_at: Some(chrono::Utc::now().timestamp_millis()),
                                });
                            }
                            Err(ref e) => {
                                println!("[IMAP] Errore nel parsing cartella: {}", e);
                            }
                        }
                    }
                    
                    println!("[IMAP] Trovate {} cartelle", result.len());
                    
                    // Aggiungi cartelle standard se non presenti
                    let has_inbox = result.iter().any(|f| f.name == "INBOX" || f.path == "INBOX");
                    if !has_inbox {
                        println!("[IMAP] INBOX non trovata, aggiungo manualmente");
                        result.insert(0, MailFolder {
                            id: format!("{}-inbox", account_id),
                            account_id: account_id.clone(),
                            name: "INBOX".to_string(),
                            path: "INBOX".to_string(),
                            unread_count: 0,
                            total_count: 0,
                            sync_at: Some(chrono::Utc::now().timestamp_millis()),
                        });
                    }
                    
                    Ok(result)
                }
                Err(ref e) => {
                    println!("[IMAP] Errore nel LIST: {}, uso mock data", e);
                    // Fallback a mock data
                    get_mock_folders(&account_id, &provider)
                }
            };
            println!("[IMAP] Logout dalla sessione IMAP...");
            let _ = session.logout().await;
            result
        }
        Err(e) => {
            println!("[IMAP] Errore nella connessione: {}, uso mock data", e);
            // Fallback a mock data se la connessione fallisce
            get_mock_folders(&account_id, &provider)
        }
    }
}

fn get_mock_folders(account_id: &str, provider: &str) -> Result<Vec<MailFolder>, String> {
    Ok(vec![
        MailFolder {
            id: format!("{}-inbox", account_id),
            account_id: account_id.to_string(),
            name: "INBOX".to_string(),
            path: "INBOX".to_string(),
            unread_count: 0,
            total_count: 0,
            sync_at: Some(chrono::Utc::now().timestamp_millis()),
        },
        MailFolder {
            id: format!("{}-sent", account_id),
            account_id: account_id.to_string(),
            name: "Sent".to_string(),
            path: if provider == "gmail" {
                "[Gmail]/Sent Mail".to_string()
            } else {
                "Sent Items".to_string()
            },
            unread_count: 0,
            total_count: 0,
            sync_at: Some(chrono::Utc::now().timestamp_millis()),
        },
        MailFolder {
            id: format!("{}-drafts", account_id),
            account_id: account_id.to_string(),
            name: "Drafts".to_string(),
            path: if provider == "gmail" {
                "[Gmail]/Drafts".to_string()
            } else {
                "Drafts".to_string()
            },
            unread_count: 0,
            total_count: 0,
            sync_at: Some(chrono::Utc::now().timestamp_millis()),
        },
        MailFolder {
            id: format!("{}-archive", account_id),
            account_id: account_id.to_string(),
            name: "Archive".to_string(),
            path: if provider == "gmail" {
                "[Gmail]/All Mail".to_string()
            } else {
                "Archive".to_string()
            },
            unread_count: 0,
            total_count: 0,
            sync_at: Some(chrono::Utc::now().timestamp_millis()),
        },
    ])
}

/// Sincronizza i messaggi di una cartella IMAP
#[tauri::command]
pub async fn sync_messages(
    account_id: String,
    folder_id: String,
    folder_path: String,
    email: String,
    provider: String,
    access_token: String,
    since: Option<i64>, // Timestamp opzionale per sincronizzazione incrementale
) -> Result<Vec<MailMessage>, String> {
    println!(
        "[IMAP] Sync messages per cartella: {} ({})",
        folder_id, folder_path
    );
    
    if let Some(since_ts) = since {
        println!("[IMAP] Sincronizzazione incrementale da: {}", since_ts);
    }
    
    // Prova a connettere al server IMAP reale
    match create_imap_session(&provider, &email, &access_token).await {
        Ok(mut session) => {
            println!("[IMAP] Sessione IMAP creata con successo per sync_messages");
            // Seleziona la cartella
            println!("[IMAP] Selezione cartella: {}", folder_path);
            match session.select(&folder_path).await {
                Ok(_) => {
                    println!("[IMAP] Cartella selezionata con successo");
                    // Costruisci query SEARCH
                    let search_query = if let Some(since_ts) = since {
                        let since_date = chrono::DateTime::from_timestamp(since_ts / 1000, 0)
                            .ok_or_else(|| "Data non valida".to_string())?;
                        format!("SINCE {}", since_date.format("%d-%b-%Y"))
                    } else {
                        "ALL".to_string()
                    };
                    
                    println!("[IMAP] Eseguo SEARCH con query: {}", search_query);
                    // Esegui SEARCH
                    match session.search(search_query).await {
                        Ok(uids) => {
                            println!("[IMAP] SEARCH completato, trovati {} UID", uids.len());
                            if uids.is_empty() {
                                println!("[IMAP] Nessun messaggio trovato");
                                let _ = session.logout().await;
                                return Ok(vec![]);
                            }
                            
                            let mut messages = Vec::new();
                            
                            // Converti HashSet in Vec e ordina
                            let mut uid_vec: Vec<u32> = uids.into_iter().collect();
                            uid_vec.sort();
                            
                            println!("[IMAP] Recupero {} messaggi in batch da 50", uid_vec.len());
                            // Fetch messaggi in batch (max 50 alla volta)
                            for chunk in uid_vec.chunks(50) {
                                let uid_set: Vec<String> = chunk.iter().map(|u| u.to_string()).collect();
                                let fetch_query = format!("{} (RFC822)", uid_set.join(","));
                                
                                match session.fetch(fetch_query, "RFC822").await {
                                    Ok(mut fetched_stream) => {
                                        while let Some(msg_result) = fetched_stream.next().await {
                                            match msg_result {
                                                Ok(msg) => {
                                                    if let Some(body) = msg.body() {
                                                        match parse_mail(body) {
                                                            Ok(parsed) => {
                                                                let subject = parsed.headers
                                                                    .get_first_value("Subject")
                                                                    .unwrap_or_else(|| "No Subject".to_string());
                                                                let from = parsed.headers
                                                                    .get_first_value("From")
                                                                    .unwrap_or_else(|| "unknown@example.com".to_string());
                                                                let date_str = parsed.headers
                                                                    .get_first_value("Date")
                                                                    .unwrap_or_else(|| String::new());
                                                                
                                                                let date = parse_mail_date(&date_str)
                                                                    .unwrap_or_else(|| chrono::Utc::now().timestamp_millis());
                                                                
                                                                let text = parsed.get_body().ok();
                                                                let html = parsed.subparts.iter()
                                                                    .find(|p| p.ctype.mimetype == "text/html")
                                                                    .and_then(|p| p.get_body().ok());
                                                                
                                                                let uid = msg.uid.unwrap_or(0);
                                                                let message_id = parsed.headers
                                                                    .get_first_value("Message-ID")
                                                                    .unwrap_or_else(|| format!("msg-{}", uid));
                                                                
                                                                // Estrai flags
                                                                let flags_vec: Vec<_> = msg.flags().collect();
                                                                let flags = flags_vec.iter()
                                                                    .map(|f| format!("{:?}", f))
                                                                    .collect();
                                                                
                                                                let is_read = flags_vec.iter().any(|f| matches!(f, async_imap::types::Flag::Seen));
                                                                let is_starred = flags_vec.iter().any(|f| matches!(f, async_imap::types::Flag::Flagged));
                                                                
                                                                println!("[IMAP] Messaggio parsato: {} (UID: {})", subject, uid);
                                                                
                                                                messages.push(MailMessage {
                                                                    id: format!("{}-msg-{}", account_id, uid),
                                                                    account_id: account_id.clone(),
                                                                    folder_id: folder_id.clone(),
                                                                    uid,
                                                                    message_id,
                                                                    subject,
                                                                    from_name: None,
                                                                    from_address: from,
                                                                    to_addresses: vec![],
                                                                    cc_addresses: None,
                                                                    bcc_addresses: None,
                                                                    date,
                                                                    text,
                                                                    html,
                                                                    flags,
                                                                    is_read,
                                                                    is_starred,
                                                                    is_important: false,
                                                                    thread_id: None,
                                                                    in_reply_to: None,
                                                                    references: None,
                                                                    synced_at: chrono::Utc::now().timestamp_millis(),
                                                                });
                                                            }
                                                            Err(e) => {
                                                                println!("[IMAP] Errore nel parsing MIME: {}", e);
                                                            }
                                                        }
                                                    } else {
                                                        println!("[IMAP] Messaggio senza body");
                                                    }
                                                }
                                                Err(e) => {
                                                    println!("[IMAP] Errore nel fetch del messaggio: {}", e);
                                                }
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        println!("[IMAP] Errore nel FETCH: {}", e);
                                    }
                                }
                            }
                            
                            println!("[IMAP] Recuperati {} messaggi totali", messages.len());
                            let _ = session.logout().await;
                            Ok(messages)
                        }
                        Err(e) => {
                            println!("[IMAP] Errore nel SEARCH: {}", e);
                            let _ = session.logout().await;
                            Err(format!("Errore nel SEARCH: {}", e))
                        }
                    }
                }
                Err(e) => {
                    println!("[IMAP] Errore nella selezione cartella: {}", e);
                    let _ = session.logout().await;
                    Err(format!("Errore nella selezione cartella: {}", e))
                }
            }
        }
        Err(e) => {
            println!("[IMAP] Errore nella connessione: {}", e);
            Err(format!("Errore nella connessione: {}", e))
        }
    }
}

fn parse_mail_date(date_str: &str) -> Option<i64> {
    // Prova a parsare la data con chrono
    chrono::DateTime::parse_from_rfc2822(date_str)
        .or_else(|_| chrono::DateTime::parse_from_rfc3339(date_str))
        .map(|dt| dt.timestamp_millis())
        .ok()
}

/// Marca un messaggio come letto/non letto sul server IMAP
#[tauri::command]
pub async fn mark_message_read(
    _account_id: String,
    folder_path: String,
    uid: u32,
    read: bool,
    email: String,
    provider: String,
    access_token: String,
) -> Result<(), String> {
    println!(
        "[IMAP] Mark message {} as {} in folder {}",
        uid,
        if read { "read" } else { "unread" },
        folder_path
    );
    
    match create_imap_session(&provider, &email, &access_token).await {
        Ok(mut session) => {
            let select_result = session.select(&folder_path).await;
            let result = match select_result {
                Ok(_) => {
                    let flag = if read { "+FLAGS (\\Seen)" } else { "-FLAGS (\\Seen)" };
                    let store_result = session.store(format!("{}", uid), flag).await;
                    match store_result {
                        Ok(mut stream) => {
                            // Consuma lo stream completamente
                            while let Some(_) = stream.next().await {}
                            Ok(())
                        }
                        Err(e) => Err(format!("Errore nel STORE: {}", e))
                    }
                }
                Err(e) => Err(format!("Errore nella selezione cartella: {}", e))
            };
            let _ = session.logout().await;
            result
        }
        Err(e) => Err(e)
    }
}

/// Sposta un messaggio da una cartella all'altra
#[tauri::command]
pub async fn move_message(
    _account_id: String,
    folder_path: String,
    uid: u32,
    target_folder: String,
    email: String,
    provider: String,
    access_token: String,
) -> Result<(), String> {
    println!(
        "[IMAP] Move message {} from {} to {}",
        uid, folder_path, target_folder
    );
    
    match create_imap_session(&provider, &email, &access_token).await {
        Ok(mut session) => {
            let select_result = session.select(&folder_path).await;
            let result = match select_result {
                Ok(_) => {
                    // COPY il messaggio
                    let copy_result = session.copy(format!("{}", uid), &target_folder).await;
                    match copy_result {
                        Ok(_) => {
                            // Marca come \Deleted nella cartella originale
                            let store_result = session.store(format!("{}", uid), "+FLAGS (\\Deleted)").await;
                            match store_result {
                                Ok(mut stream) => {
                                    // Consuma lo stream completamente
                                    while let Some(_) = stream.next().await {}
                                    Ok(())
                                }
                                Err(e) => Err(format!("Errore nel STORE: {}", e))
                            }
                        }
                        Err(e) => Err(format!("Errore nel COPY: {}", e))
                    }
                }
                Err(e) => Err(format!("Errore nella selezione cartella: {}", e))
            };
            let _ = session.logout().await;
            result
        }
        Err(e) => Err(e)
    }
}

/// Elimina un messaggio dal server IMAP
#[tauri::command]
pub async fn delete_message(
    _account_id: String,
    folder_path: String,
    uid: u32,
    email: String,
    provider: String,
    access_token: String,
) -> Result<(), String> {
    println!("[IMAP] Delete message {} from folder {}", uid, folder_path);
    
    match create_imap_session(&provider, &email, &access_token).await {
        Ok(mut session) => {
            let select_result = session.select(&folder_path).await;
            let result = match select_result {
                Ok(_) => {
                    // Marca come \Deleted
                    let store_result = session.store(format!("{}", uid), "+FLAGS (\\Deleted)").await;
                    match store_result {
                        Ok(mut stream) => {
                            // Consuma lo stream completamente prima di chiamare expunge
                            while let Some(_) = stream.next().await {}
                            Ok(())
                        }
                        Err(e) => Err(format!("Errore nel STORE: {}", e))
                    }
                }
                Err(e) => Err(format!("Errore nella selezione cartella: {}", e))
            };
            // Se store è andato a buon fine, esegui expunge
            let final_result = match result {
                Ok(_) => {
                    // EXPUNGE per eliminare definitivamente
                    match session.expunge().await {
                        Ok(_) => Ok(()),
                        Err(e) => Err(format!("Errore nell'EXPUNGE: {}", e))
                    }
                }
                Err(e) => Err(e)
            };
            let _ = session.logout().await;
            final_result
        }
        Err(e) => Err(e)
    }
}
