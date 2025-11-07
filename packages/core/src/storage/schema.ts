/**
 * Schema database SQLite per lo storage locale
 */

import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Tabella account
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  provider: text('provider').notNull(), // 'gmail' | 'outlook'
  displayName: text('display_name').notNull(),
  accessToken: blob('access_token').notNull(), // encrypted
  refreshToken: blob('refresh_token').notNull(), // encrypted
  expiresAt: integer('expires_at').notNull(),
  tokenType: text('token_type').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Tabella cartelle
export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  path: text('path').notNull(),
  unreadCount: integer('unread_count').default(0),
  totalCount: integer('total_count').default(0),
  syncAt: integer('sync_at'),
});

// Tabella messaggi
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  folderId: text('folder_id').notNull().references(() => folders.id, { onDelete: 'cascade' }),
  uid: integer('uid').notNull(),
  messageId: text('message_id').notNull(),
  subject: text('subject').notNull(),
  fromName: text('from_name'),
  fromAddress: text('from_address').notNull(),
  toAddresses: text('to_addresses').notNull(), // JSON array
  ccAddresses: text('cc_addresses'), // JSON array
  bccAddresses: text('bcc_addresses'), // JSON array
  date: integer('date').notNull(),
  text: text('text'),
  html: text('html'),
  flags: text('flags').notNull(), // JSON array
  isRead: integer('is_read').default(0),
  isStarred: integer('is_starred').default(0),
  isImportant: integer('is_important').default(0),
  threadId: text('thread_id'),
  inReplyTo: text('in_reply_to'),
  references: text('references'), // JSON array
  syncedAt: integer('synced_at').notNull(),
});

// Tabella allegati
export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  contentId: text('content_id'),
  content: blob('content').notNull(),
});

// Tabella impostazioni
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON
});

