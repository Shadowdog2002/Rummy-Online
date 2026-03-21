import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { initSocket } from '../socket';

type Tab = 'guest' | 'login' | 'register';

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('guest');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore(s => s.setAuth);
  const token = useAuthStore(s => s.token);
  const navigate = useNavigate();

  if (token) {
    navigate('/lobby');
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let url = '';
      let body: Record<string, string> = {};

      const api = import.meta.env.PROD ? window.location.origin : `http://${window.location.hostname}:3001`;
      if (tab === 'guest') {
        url = `${api}/auth/guest`;
        body = { username };
      } else if (tab === 'login') {
        url = `${api}/auth/login`;
        body = { email, password };
      } else {
        url = `${api}/auth/register`;
        body = { username, email, password };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { token?: string; user?: { id: string; username: string; isGuest: boolean }; error?: string };
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }

      setAuth(data.user!, data.token!);
      initSocket(data.token!);
      navigate('/lobby');
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'guest', label: 'Play as Guest' },
    { key: 'login', label: 'Login' },
    { key: 'register', label: 'Register' },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-felt-dark">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-2 text-yellow-400 tracking-wide">
          Rummy Online
        </h1>
        <p className="text-center text-green-300 mb-8 text-sm">2-Player Indian Rummy with Chess Clock</p>

        <div className="bg-felt rounded-2xl shadow-2xl p-8">
          {/* Tabs */}
          <div className="flex rounded-lg overflow-hidden mb-6 bg-felt-dark">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  tab === t.key ? 'bg-yellow-400 text-felt-dark' : 'text-green-300 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {(tab === 'guest' || tab === 'register') && (
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-felt-dark text-white placeholder-green-600 border border-green-700 focus:outline-none focus:border-yellow-400"
                required
                minLength={2}
              />
            )}
            {(tab === 'login' || tab === 'register') && (
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-felt-dark text-white placeholder-green-600 border border-green-700 focus:outline-none focus:border-yellow-400"
                required
              />
            )}
            {(tab === 'login' || tab === 'register') && (
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-felt-dark text-white placeholder-green-600 border border-green-700 focus:outline-none focus:border-yellow-400"
                required
                minLength={6}
              />
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-felt-dark font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : tab === 'guest' ? 'Play Now' : tab === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
