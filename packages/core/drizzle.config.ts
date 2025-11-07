import type { Config } from 'drizzle-kit';

export default {
  schema: './src/storage/schema.ts',
  out: './src/storage/migrations',
  driver: 'better-sqlite',
  dbCredentials: {
    url: './mail-client.db',
  },
} satisfies Config;

