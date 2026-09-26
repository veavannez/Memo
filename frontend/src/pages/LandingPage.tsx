import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8000';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) navigate('/projects');
  }, [isAuthenticated, navigate]);

  const handleGitHubLogin = async () => {
    try {
      const res = await api.get('/auth/github/login');
      const { auth_url } = res.data;
      window.location.href = auth_url;
    } catch {
      window.location.href = `${BACKEND_URL}/api/v1/auth/github/login`;
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <span className="font-bold text-xl tracking-tight">MEMO</span>
        <button onClick={handleGitHubLogin} className="btn-primary">
          Sign in
        </button>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-3xl mx-auto w-full">
        <div className="mb-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            Developer handoff tool
          </span>
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-4">
          MEMO
        </h1>
        <p className="text-xl text-gray-500 mb-2 font-light">
          Save your work. Share the context. Keep coding.
        </p>
        <p className="text-base text-gray-400 mb-10 max-w-xl">
          GitHub tells the team what changed. MEMO tells them what it means,
          where you left off, and what should happen next.
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={handleGitHubLogin}
            className="btn-primary text-base px-6 py-3 rounded-lg shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Continue with GitHub
          </button>
          <Link to="/demo" className="btn-secondary text-base px-6 py-3 rounded-lg">
            See a demo →
          </Link>
        </div>

        {/* Feature callouts */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left w-full">
          {[
            {
              title: 'Create Memos',
              desc: 'End each session with context: what you finished, what\'s in progress, what\'s blocking you, and what\'s next.',
            },
            {
              title: 'Team Dashboard',
              desc: 'See exactly what everyone is working on, where they left off, and what\'s blocking the team.',
            },
            {
              title: 'Catch Me Up',
              desc: 'Return to a project and instantly understand what happened while you were gone.',
            },
          ].map((f) => (
            <div key={f.title} className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        MEMO — Developer handoff, simplified.
      </footer>
    </div>
  );
}
