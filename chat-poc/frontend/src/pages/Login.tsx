import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'client' | 'agent'>('client');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      if (!loginRes.ok) {
        const body = await loginRes.json().catch(() => ({}));
        throw new Error((body as any)?.message ?? 'Echec de la connexion');
      }

      const { token } = await loginRes.json();
      localStorage.setItem('ycyw_token', token);
      localStorage.setItem('ycyw_role', role);
      localStorage.setItem('ycyw_email', email.trim());

      if (role === 'client') {
        const sessionRes = await fetch(`${API_URL}/chat/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subject: subject.trim() || 'Question generale' }),
        });

        if (!sessionRes.ok) throw new Error('Impossible de creer la session de tchat');
        const session = await sessionRes.json();
        navigate(`/chat/${session.id}`);
      } else {
        const sessionId = window.prompt(
          'Identifiant de la session tchat a rejoindre (UUID) :',
        );
        if (!sessionId?.trim()) {
          setError('Un identifiant de session est requis pour les agents.');
          setLoading(false);
          return;
        }
        navigate(`/chat/${sessionId.trim()}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur reseau';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 8 }}>YCYW — Support Client</h1>
      <p style={{ color: '#555', marginBottom: 32, marginTop: 0 }}>
        Connectez-vous pour demarrer ou rejoindre une session de tchat.
      </p>

      <form onSubmit={handleSubmit} noValidate aria-label="Formulaire de connexion">
        {error && (
          <p
            role="alert"
            style={{
              background: '#fdecea',
              color: '#c0392b',
              padding: '10px 14px',
              borderRadius: 4,
              margin: '0 0 20px',
              fontSize: 14,
            }}
          >
            {error}
          </p>
        )}

        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="email"
            style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}
          >
            Adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="prenom@exemple.com"
            aria-required="true"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 16,
              border: '1px solid #ccc',
              borderRadius: 4,
            }}
          />
        </div>

        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
          <legend style={{ fontWeight: 600, marginBottom: 8, padding: 0 }}>Role</legend>
          <div style={{ display: 'flex', gap: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                name="role"
                value="client"
                checked={role === 'client'}
                onChange={() => setRole('client')}
              />
              Client
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                name="role"
                value="agent"
                checked={role === 'agent'}
                onChange={() => setRole('agent')}
              />
              Agent support
            </label>
          </div>
        </fieldset>

        {role === 'client' && (
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="subject"
              style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}
            >
              Sujet{' '}
              <span style={{ fontWeight: 400, color: '#777' }}>(facultatif)</span>
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex : probleme de reservation"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 16,
                border: '1px solid #ccc',
                borderRadius: 4,
              }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim()}
          style={{
            width: '100%',
            padding: '12px',
            background: '#1a4fdb',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 16,
            fontWeight: 600,
            cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !email.trim() ? 0.65 : 1,
          }}
        >
          {loading
            ? 'Connexion en cours...'
            : role === 'client'
              ? 'Demarrer le tchat'
              : 'Rejoindre une session'}
        </button>
      </form>
    </main>
  );
}
