// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::imap::{sync_folders, sync_messages, mark_message_read, move_message, delete_message};
use commands::smtp::send_email;
use commands::system::open_url_in_browser;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            sync_folders,
            sync_messages,
            mark_message_read,
            move_message,
            delete_message,
            send_email,
            open_url_in_browser,
        ])
        .setup(|_app| {
            // La trasparenza e il blur sono gestiti da:
            // 1. transparent: true in tauri.conf.json per la trasparenza base
            // 2. backdrop-filter: blur() in CSS per l'effetto blur
            // 3. decorations: true e titleBarStyle: "Overlay" per bordi arrotondati e titlebar trasparente
            
            // Inizializza il database e altre configurazioni all'avvio
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

