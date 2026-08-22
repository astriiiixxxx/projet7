import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket, ChatMessage } from '../hooks/useSocket';

const STATUS_LABELS: Record<string, string> = {
  connecting: 'Connexion...',
  joining: 'Chargement...',
  ready: 'Pret',
  disconnected: 'Deconnecte',
  error: 'Erreur',
};

const STATUS_COLORS: Record<string, string> = {
  connecting: '#e67e22',
  joining: '#e67e22',
  ready: '#27ae60',
  disconnected: '#7f8c8d',
  error: '#e74c3c',
};

export default function Chat() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem('ycyw_token') ?? '';
  const role = localStorage.getItem('ycyw_role') ?? 'client';
  const email = localStorage.getItem('ycyw_email') ?? '';
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { state, sendMessage, closeSession } = useSocket(sessionId!, token);

  useEffect(() => { if (!token) navigate('/login'); }, [token, navigate]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [state.messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || state.status !== 'ready') return;
    sendMessage(inputValue.trim());
    setInputValue('');
  };

  const canSend = state.status === 'ready' && inputValue.trim().length > 0;

  const renderMessage = (msg: ChatMessage) => {
    const isSystem = msg.sender_role === 'system';
    const isOwn = msg.sender_email === email;
    const sentAt = new Date(msg.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    if (isSystem) {
      return (
        <div key={msg.id} role="status" style={{ textAlign: 'center', fontSize: 12, color: '#666', fontStyle: 'italic', padding: '4px 0' }}>
          {msg.content}
        </div>
      );
    }

    return (
      <article key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', maxWidth: '72%', alignSelf: isOwn ? 'flex-end' : 'flex-start' }}>
        <p style={{ margin: '0 0 2px', fontSize: 11, color: '#777' }} aria-hidden="true">
          <strong>{isOwn ? 'Vous' : msg.sender_email ?? msg.sender_role}</strong> · {sentAt}
        </p>
        <div style={{ background: isOwn ? '#1a4fdb' : '#e8ecf0', color: isOwn ? '#fff' : '#1a1a1a', padding: '10px 14px', borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px', fontSize: 15, lineHeight: 1.45, wordBreak: 'break-word' }}>
          {msg.content}
        </div>
      </article>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: 820, margin: '0 auto', background: '#fff', boxShadow: '0 0 0 1px #e0e0e0' }}>
      <header role="banner" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: '#1a4fdb', color: '#fff', flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>YCYW Support</h1>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>
            Session : <code style={{ background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace', fontSize: 11 }}>{sessionId}</code>
          </p>
        </div>
        <div role="status" aria-label={`Statut : ${STATUS_LABELS[state.status]}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span aria-hidden="true" style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: STATUS_COLORS[state.status] ?? '#ccc' }} />
          {STATUS_LABELS[state.status]}
        </div>
        {role === 'agent' && state.status === 'ready' && (
          <button onClick={closeSession} aria-label="Cloturer la session" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Cloturer
          </button>
        )}
      </header>

      {state.error && (
        <div role="alert" style={{ padding: '8px 20px', background: '#fdecea', color: '#c0392b', fontSize: 14, flexShrink: 0 }}>
          {state.error}
        </div>
      )}

      {state.session?.subject && state.status === 'ready' && (
        <div style={{ padding: '6px 20px', background: '#f0f4ff', color: '#1a4fdb', fontSize: 13, flexShrink: 0 }}>
          <strong>Sujet :</strong> {state.session.subject}
          {state.session.agent_id
            ? <span style={{ marginLeft: 16, color: '#27ae60' }}>Agent assigne</span>
            : <span style={{ marginLeft: 16, color: '#e67e22' }}>En attente d'un agent</span>}
        </div>
      )}

      <main aria-live="polite" aria-label="Messages" style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {state.status === 'joining' && <p role="status" style={{ color: '#888', textAlign: 'center', marginTop: 60 }}>Chargement...</p>}
        {state.status === 'ready' && state.messages.length === 0 && (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: 60 }}>
            {role === 'client' ? 'Aucun message. Envoyez votre premiere question !' : 'En attente du client.'}
          </p>
        )}
        {state.messages.map(renderMessage)}
        <div ref={messagesEndRef} aria-hidden="true" />
      </main>

      <footer style={{ padding: '12px 20px', borderTop: '1px solid #e5e5e5', background: '#fafafa', flexShrink: 0 }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
          <label htmlFor="chat-input" className="sr-only">Votre message</label>
          <input
            id="chat-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={state.status === 'ready' ? 'Ecrivez votre message...' : 'Connexion en cours...'}
            disabled={state.status !== 'ready'}
            autoComplete="off"
            style={{ flex: 1, padding: '10px 14px', fontSize: 15, border: '1px solid #ccc', borderRadius: 4, background: state.status !== 'ready' ? '#f5f5f5' : '#fff' }}
          />
          <button type="submit" disabled={!canSend} aria-label="Envoyer" style={{ padding: '10px 22px', background: '#1a4fdb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 15, fontWeight: 600, cursor: canSend ? 'pointer' : 'not-allowed', opacity: canSend ? 1 : 0.55 }}>
            Envoyer
          </button>
        </form>
      </footer>
    </div>
  );
}
