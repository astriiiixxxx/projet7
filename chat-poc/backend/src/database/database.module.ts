import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';

export const DATABASE_POOL = 'DATABASE_POOL';

const databasePoolProvider = {
  provide: DATABASE_POOL,
  useFactory: async (): Promise<Pool> => {
    const pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432'),
      database: process.env.DB_NAME ?? 'ycyw_chat',
      user: process.env.DB_USER ?? 'ycyw',
      password: process.env.DB_PASSWORD ?? 'ycyw_secret',
    });

    await runMigrations(pool);
    return pool;
  },
};

async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id   VARCHAR(255) NOT NULL,
      agent_id    VARCHAR(255),
      status      VARCHAR(20)  NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'active', 'closed')),
      subject     VARCHAR(500),
      created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id   UUID         NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      sender_id    VARCHAR(255) NOT NULL,
      sender_role  VARCHAR(20)  NOT NULL CHECK (sender_role IN ('client', 'agent', 'system')),
      content      TEXT         NOT NULL,
      sent_at      TIMESTAMP    NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
      ON chat_messages(session_id, sent_at ASC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_client_id
      ON chat_sessions(client_id)
  `);

  console.log('✅ Migrations PostgreSQL appliquées (chat_sessions, chat_messages)');
}

@Global()
@Module({
  providers: [databasePoolProvider],
  exports: [databasePoolProvider],
})
export class DatabaseModule {}
