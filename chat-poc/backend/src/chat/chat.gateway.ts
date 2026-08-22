import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { ChatService } from './chat.service';
import { AuthService } from '../auth/auth.service';

interface AuthSocket extends Socket {
  userId: string;
  userEmail: string;
  userRole: 'client' | 'agent';
}

interface RedisPayload {
  type: 'message' | 'system' | 'session_closed';
  sessionId: string;
  message: {
    id: string;
    session_id: string;
    sender_id: string;
    sender_email?: string;
    sender_role: string;
    content: string;
    sent_at: Date | string;
  };
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
    ],
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;

  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly CHANNEL_PATTERN = 'ycyw:chat:*';
  private readonly CHANNEL_PREFIX = 'ycyw:chat:';

  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
  ) {
    const redisConfig = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      lazyConnect: true,
    };
    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
  }

  afterInit(server: Server): void {
    this.subscriber.psubscribe(this.CHANNEL_PATTERN, (err) => {
      if (err) {
        console.error('Echec souscription Redis Pub/Sub :', err.message);
        return;
      }
      console.log(`Redis Pub/Sub actif — ecoute sur ${this.CHANNEL_PATTERN}`);
    });

    this.subscriber.on('pmessage', (_pattern, channel, rawMessage) => {
      const sessionId = channel.replace(this.CHANNEL_PREFIX, '');
      const roomName = `session:${sessionId}`;

      let payload: RedisPayload;
      try {
        payload = JSON.parse(rawMessage) as RedisPayload;
      } catch (e) {
        console.error('Erreur parsing message Redis :', e);
        return;
      }

      server.to(roomName).emit('message:received', payload);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth as any)?.token ??
      (client.handshake.headers.authorization ?? '').replace('Bearer ', '').trim();

    if (!token) {
      client.emit('auth:error', { message: 'Token manquant' });
      client.disconnect(true);
      return;
    }

    const session = await this.authService.validateToken(token);
    if (!session) {
      client.emit('auth:error', { message: 'Token invalide ou expire' });
      client.disconnect(true);
      return;
    }

    const authSocket = client as AuthSocket;
    authSocket.userId = session.userId;
    authSocket.userEmail = session.email;
    authSocket.userRole = session.role;

    client.emit('auth:success', { userId: session.userId, role: session.role });
    console.log(`Connecte : ${session.email} (${session.role}) — ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    const email = (client as AuthSocket).userEmail ?? 'inconnu';
    console.log(`Deconnecte : ${email} — ${client.id}`);
  }

  @SubscribeMessage('session:join')
  async handleJoinSession(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { sessionId: string },
  ): Promise<void> {
    const { sessionId } = data;

    const session = await this.chatService.getSession(sessionId);
    if (!session) {
      client.emit('session:error', { message: `Session ${sessionId} introuvable` });
      return;
    }

    if (client.userRole === 'agent' && !session.agent_id) {
      await this.chatService.assignAgent(sessionId, client.userId);
    }

    const roomName = `session:${sessionId}`;
    await client.join(roomName);

    const history = await this.chatService.getMessages(sessionId);
    const freshSession = await this.chatService.getSession(sessionId);
    client.emit('session:joined', { sessionId, session: freshSession, history });

    const systemMsg = await this.chatService.saveMessage(
      sessionId,
      'system',
      'system',
      `${client.userEmail} (${client.userRole}) a rejoint la session`,
    );

    await this.publish(sessionId, 'system', systemMsg);
  }

  @SubscribeMessage('message:send')
  async handleMessageSend(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { sessionId: string; content: string },
  ): Promise<void> {
    const { sessionId, content } = data;

    if (!content?.trim()) {
      client.emit('message:error', { message: 'Le contenu du message est vide' });
      return;
    }

    const savedMessage = await this.chatService.saveMessage(
      sessionId,
      client.userId,
      client.userRole,
      content.trim(),
    );

    await this.publish(sessionId, 'message', {
      ...savedMessage,
      sender_email: client.userEmail,
    });

    client.emit('message:sent', { messageId: savedMessage.id });
  }

  @SubscribeMessage('session:close')
  async handleSessionClose(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { sessionId: string },
  ): Promise<void> {
    const { sessionId } = data;
    await this.chatService.closeSession(sessionId);

    const systemMsg = await this.chatService.saveMessage(
      sessionId,
      'system',
      'system',
      'La session de tchat a ete cloturee',
    );

    await this.publish(sessionId, 'session_closed', systemMsg);
  }

  private async publish(
    sessionId: string,
    type: RedisPayload['type'],
    message: RedisPayload['message'],
  ): Promise<void> {
    const payload: RedisPayload = { type, sessionId, message };
    await this.publisher.publish(
      `${this.CHANNEL_PREFIX}${sessionId}`,
      JSON.stringify(payload),
    );
  }
}
