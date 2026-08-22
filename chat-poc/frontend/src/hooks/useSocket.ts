import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  sender_email?: string;
  sender_role: 'client' | 'agent' | 'system';
  content: string;
  sent_at: string;
}

export interface ChatSession {
  id: string;
  client_id: string;
  agent_id: string | null;
  status: 'waiting' | 'active' | 'closed';
  subject: string | null;
}

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'joining'
  | 'ready'
  | 'disconnected'
  | 'error';

export interface SocketState {
  status: ConnectionStatus;
  session: ChatSession | null;
  messages: ChatMessage[];
  error: string | null;
}

export function useSocket(sessionId: string, token: string) {
  const socketRef = useRef<Socket | null>(null);

  const [state, setState] = useState<SocketState>({
    status: 'connecting',
    session: null,
    messages: [],
    error: null,
  });

  useEffect(() => {
    if (!token || !sessionId) return;

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setState((prev) => ({ ...prev, status: 'joining', error: null }));
      socket.emit('session:join', { sessionId });
    });

    socket.on('disconnect', (reason) => {
      setState((prev) => ({
        ...prev,
        status: 'disconnected',
        error: reason === 'io server disconnect' ? 'Deconnecte par le serveur' : null,
      }));
    });

    socket.on('connect_error', (err) => {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: `Impossible de joindre le serveur : ${err.message}`,
      }));
    });

    socket.on('auth:error', (data: { message: string }) => {
      setState((prev) => ({ ...prev, status: 'error', error: data.message }));
    });

    socket.on(
      'session:joined',
      (data: { sessionId: string; session: ChatSession; history: ChatMessage[] }) => {
        setState((prev) => ({
          ...prev,
          status: 'ready',
          session: data.session,
          messages: data.history,
          error: null,
        }));
      },
    );

    socket.on('session:error', (data: { message: string }) => {
      setState((prev) => ({ ...prev, status: 'error', error: data.message }));
    });

    socket.on(
      'message:received',
      (payload: { type: string; message: ChatMessage }) => {
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, payload.message],
          status: payload.type === 'session_closed' ? 'error' : prev.status,
          error:
            payload.type === 'session_closed'
              ? 'La session a ete cloturee par l\'agent'
              : prev.error,
        }));
      },
    );

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, token]);

  const sendMessage = useCallback(
    (content: string) => {
      socketRef.current?.emit('message:send', { sessionId, content });
    },
    [sessionId],
  );

  const closeSession = useCallback(() => {
    socketRef.current?.emit('session:close', { sessionId });
  }, [sessionId]);

  return { state, sendMessage, closeSession };
}
