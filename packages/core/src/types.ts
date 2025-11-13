/**
 * Tipi principali per il client email
 */

export type AccountProvider = 'gmail' | 'outlook';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
}

export interface Account {
  id: string;
  email: string;
  provider: AccountProvider;
  displayName: string;
  tokens: OAuthTokens;
  createdAt: number;
  updatedAt: number;
}

export interface MailFolder {
  id: string;
  accountId: string;
  name: string;
  path: string;
  unreadCount: number;
  totalCount: number;
  syncAt?: number;
}

export interface MailAttachment {
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  content: Buffer;
}

export interface MailMessage {
  id: string;
  accountId: string;
  folderId: string;
  uid: number;
  messageId: string;
  subject: string;
  from: MailAddress;
  to: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  date: Date;
  text?: string;
  html?: string;
  attachments: MailAttachment[];
  flags: string[];
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
  syncedAt: number;
}

export interface MailAddress {
  name?: string;
  address: string;
}

export interface ComposeMessage {
  to: (string | MailAddress)[];
  cc?: (string | MailAddress)[];
  bcc?: (string | MailAddress)[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: MailAttachment[];
  inReplyTo?: string;
}

export interface SyncStatus {
  accountId: string;
  folderId: string;
  status: 'idle' | 'syncing' | 'error';
  lastSync?: number;
  error?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  syncInterval: number; // minuti
  autoSync: boolean;
  defaultAccount?: string;
}

