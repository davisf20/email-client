use serde::{Deserialize, Serialize};
use lettre::{
    message::{header::ContentType, Mailbox, Message, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    SmtpTransport, Transport,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct Attachment {
    pub filename: String,
    pub content_type: String,
    pub content: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComposeMessage {
    pub to: Vec<String>,
    pub cc: Option<Vec<String>>,
    pub bcc: Option<Vec<String>>,
    pub subject: String,
    pub body_html: Option<String>,
    pub body_text: Option<String>,
    pub attachments: Option<Vec<Attachment>>,
}

/// Invia un'email tramite SMTP
#[tauri::command]
pub async fn send_email(
    account_id: String,
    email: String,
    provider: String,
    access_token: String,
    message: ComposeMessage,
) -> Result<(), String> {
    println!(
        "[SMTP] Send email da account: {} ({})",
        account_id, email
    );
    println!("[SMTP] To: {:?}", message.to);
    println!("[SMTP] Subject: {}", message.subject);
    
    // Configurazione SMTP in base al provider
    let (host, port, use_tls) = match provider.as_str() {
        "gmail" => ("smtp.gmail.com", 465, true),
        "outlook" => ("smtp.office365.com", 587, false),
        _ => return Err(format!("Provider non supportato: {}", provider)),
    };
    
    // Costruisci il messaggio
    let from_mailbox: Mailbox = email
        .parse()
        .map_err(|e| format!("Email mittente non valida: {}", e))?;
    
    let to_mailboxes: Vec<Mailbox> = message
        .to
        .iter()
        .map(|addr| {
            addr.parse()
                .map_err(|e| format!("Email destinatario non valida {}: {}", addr, e))
        })
        .collect::<Result<Vec<_>, _>>()?;
    
    let mut builder = Message::builder()
        .from(from_mailbox)
        .subject(&message.subject);
    
    // Aggiungi destinatari
    for to_mb in &to_mailboxes {
        builder = builder.to(to_mb.clone());
    }
    
    // Aggiungi CC se presente
    if let Some(cc) = &message.cc {
        for cc_addr in cc {
            if let Ok(cc_mb) = cc_addr.parse::<Mailbox>() {
                builder = builder.cc(cc_mb);
            }
        }
    }
    
    // Aggiungi BCC se presente
    if let Some(bcc) = &message.bcc {
        for bcc_addr in bcc {
            if let Ok(bcc_mb) = bcc_addr.parse::<Mailbox>() {
                builder = builder.bcc(bcc_mb);
            }
        }
    }
    
    // Costruisci il corpo del messaggio
    let email_message = if let Some(html) = &message.body_html {
        // Messaggio HTML con fallback text
        let text_part = message.body_text.as_deref().unwrap_or("");
        builder
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_PLAIN)
                            .body(text_part.to_string()),
                    )
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_HTML)
                            .body(html.clone()),
                    ),
            )
            .map_err(|e| format!("Errore nella costruzione del messaggio: {}", e))?
    } else {
        // Solo testo
        builder
            .body(
                message
                    .body_text
                    .as_deref()
                    .unwrap_or("")
                    .to_string(),
            )
            .map_err(|e| format!("Errore nella costruzione del messaggio: {}", e))?
    };
    
    // Crea il trasporto SMTP
    let mailer_builder = if use_tls {
        SmtpTransport::relay(host)
            .map_err(|e| format!("Errore nella creazione del trasporto SMTP: {}", e))?
    } else {
        SmtpTransport::builder_dangerous(host).port(port)
    };
    
    // Autenticazione OAuth2 (per ora usa access_token come password)
    // Nota: Per OAuth2 completo, serve implementare XOAUTH2
    let creds = Credentials::new(email.clone(), access_token);
    let mailer = mailer_builder.credentials(creds).build();
    
    // Invia l'email
    match mailer.send(&email_message) {
        Ok(_) => {
            println!("[SMTP] Email inviata con successo!");
            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Errore nell'invio dell'email: {:?}", e);
            println!("[SMTP] {}", error_msg);
            Err(error_msg)
        }
    }
}

