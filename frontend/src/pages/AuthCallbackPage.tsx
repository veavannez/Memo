import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) {
      navigate('/?error=missing_params');
      return;
    }

    api.post(`/auth/github/callback?code=${code}&state=${state}`)
      .then((res) => {
        const { access_token, user } = res.data;
        localStorage.setItem('access_token', access_token);
        setUser(user);
        navigate('/projects');
      })
      .catch(() => {
        navigate('/?error=auth_failed');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Completing sign in…</p>
      </div>
    </div>
  );
}
