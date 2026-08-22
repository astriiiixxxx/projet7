import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';

export interface ChatSession {
  id: string;
  client_id: string;
  agent_id: string | null;
  status: 'waiting' | 'active' | 'closed';
  subject: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  sender_role: 'client' | 'agent' | 'system';
  content: string;
  sent_at: Date;
}

@Injectable()
export class ChatService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async createSession(clientId: string, subject?: string): Promise<ChatSession> {
    const { rows } = await this.pool.query<ChatSession>(
      `INSERT INTO chat_sessions (client_id, subject)
       VALUES ($1, $2)
       RETURNING *`,
      [clientId, subject ?? null],
    );
    return rows[0];
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const { rows } = await this.pool.query<ChatSession>(
      'SELECT * FROM chat_sessions WHERE id = $1',
      [sessionId],
    );
    return rows[0] ?? null;
  }

  async assignAgent(sessionId: string, agentId: string): Promise<void> {
    await this.pool.query(
      `UPDATE chat_sessions
       SET agent_id = $1, status = 'active', updated_at = NOW()
       WHERE id = $2 AND agent_id IS NULL`,
      [agentId, sessionId],
    );
  }

  async saveMessage(
    sessionId: string,
    senderId: string,
    senderRole: 'client' | 'agent' | 'system',
    content: string,
  ): Promise<ChatMessage> {
    const { rows } = await this.pool.query<ChatMessage>(
      `INSERT INTO chat_messages (session_id, sender_id, sender_role, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [sessionId, senderId, senderRole, content],
    );
    return rows[0];
  }

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const { rows } = await this.pool.query<ChatMessage>(
      `SELECT * FROM chat_messages
       WHERE session_id = $1
       ORDER BY sent_at ASC`,
      [sessionId],
    );
    return rows;
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE chat_sessions
       SET status = 'closed', updated_at = NOW()
       WHERE id = $1`,
      [sessionId],
    );
  }
}
