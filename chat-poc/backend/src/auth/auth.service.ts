import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

export interface SessionData {
  userId: string;
  email: string;
  role: 'client' | 'agent';
}

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly SESSION_TTL_SECONDS = 86400; // 24 h

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      lazyConnect: true,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async login(email: string, role: 'client' | 'agent'): Promise<string> {
    const token = uuidv4();
    const userId = `${role}_${email.split('@')[0]}_${Date.now()}`;
    const data: SessionData = { userId, email, role };

    await this.redis.setex(
      `session:${token}`,
      this.SESSION_TTL_SECONDS,
      JSON.stringify(data),
    );

    return token;
  }

  async validateToken(token: string): Promise<SessionData | null> {
    if (!token) return null;
    const raw = await this.redis.get(`session:${token}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }
}
