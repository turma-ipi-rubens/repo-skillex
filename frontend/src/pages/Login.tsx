/** Tela de login. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../services/api';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const user = await login(String(data.get('email')), String(data.get('password')));
      navigate(user.onboardingCompleted ? '/feed' : '/onboarding');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Erro ao entrar', 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-brand">
        <div className="logo-mark">
          <i className="bi bi-arrow-left-right"></i>
        </div>
        <h1>
          Skill<span>Ex</span>
        </h1>
        <p>Troque habilidades. Aprenda com pessoas.</p>
      </div>
      <form id="auth-form" onSubmit={onSubmit}>
        <div className="field">
          <label className="field__label">E-mail</label>
          <input className="input" name="email" type="email" placeholder="voce@email.com" required />
        </div>
        <div className="field">
          <label className="field__label">Senha</label>
          <div className="password-input">
            <input
              className="input"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              className="password-input__toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
            >
              <Icon name={showPassword ? 'eye-slash' : 'eye'} />
            </button>
          </div>
        </div>
        <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p className="auth-switch">
        <Link to="/forgot-password">Esqueci minha senha</Link>
      </p>
      <p className="auth-switch">
        Não tem conta? <Link to="/register">Cadastre-se</Link>
      </p>
      <p className="auth-switch muted" style={{ fontSize: '.78rem' }}>
        Conta de teste: ana@skillex.com · senha123
      </p>
    </div>
  );
}
