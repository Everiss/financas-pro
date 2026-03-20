import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  auth, googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from '../firebase';

interface AuthModalProps {
  onClose: () => void;
}

type Tab = 'login' | 'register' | 'reset';

export function AuthModal({ onClose }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const clear = () => { setError(''); setResetSent(false); };

  const handleGoogle = async () => {
    setLoading(true); clear();
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (e: any) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); clear();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onClose();
    } catch (e: any) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    setLoading(true); clear();
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) await updateProfile(user, { displayName: name.trim() });
      onClose();
    } catch (e: any) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); clear();
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (e: any) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: 'spring', duration: 0.35 }}
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center relative">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/25">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-slate-900">
              {tab === 'login' && 'Bem-vindo de volta'}
              {tab === 'register' && 'Crie sua conta grátis'}
              {tab === 'reset' && 'Recuperar senha'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {tab === 'login' && 'Acesse sua conta Finanças Pro'}
              {tab === 'register' && '14 dias PRO grátis, sem cartão'}
              {tab === 'reset' && 'Enviaremos um link para seu e-mail'}
            </p>
          </div>

          <div className="px-8 pb-8 space-y-4">

            {/* Abas Login / Cadastro */}
            {tab !== 'reset' && (
              <div className="flex bg-slate-100 rounded-2xl p-1">
                {(['login', 'register'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); clear(); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                      tab === t
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t === 'login' ? 'Entrar' : 'Criar conta'}
                  </button>
                ))}
              </div>
            )}

            {/* Botão Google */}
            {tab !== 'reset' && (
              <>
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm py-3 rounded-2xl transition-all active:scale-[.98] disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continuar com Google
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400 font-medium">ou com e-mail</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
              </>
            )}

            {/* Formulário Login */}
            {tab === 'login' && (
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
                <PasswordField label="Senha" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(v => !v)} />

                {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-sm transition-all active:scale-[.98] shadow-lg shadow-blue-600/20">
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>

                <button type="button" onClick={() => { setTab('reset'); clear(); }} className="w-full text-center text-sm text-slate-400 hover:text-blue-600 transition-colors">
                  Esqueci minha senha
                </button>
              </form>
            )}

            {/* Formulário Cadastro */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3">
                <Field label="Nome completo" type="text" value={name} onChange={setName} placeholder="Seu nome" />
                <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
                <PasswordField label="Senha (mín. 6 caracteres)" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(v => !v)} />

                {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-sm transition-all active:scale-[.98] shadow-lg shadow-blue-600/20">
                  {loading ? 'Criando conta...' : 'Criar conta grátis'}
                </button>

                <p className="text-center text-xs text-slate-400">
                  Ao criar sua conta você concorda com os{' '}
                  <a href="#" className="text-blue-500 hover:underline">Termos de Uso</a>.
                </p>
              </form>
            )}

            {/* Recuperar senha */}
            {tab === 'reset' && (
              <form onSubmit={handleReset} className="space-y-4">
                {resetSent ? (
                  <div className="text-center py-4 space-y-3">
                    <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <p className="font-semibold text-slate-800">E-mail enviado!</p>
                    <p className="text-sm text-slate-500">Verifique sua caixa de entrada e siga o link para redefinir sua senha.</p>
                  </div>
                ) : (
                  <>
                    <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-sm transition-all active:scale-[.98]">
                      {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                    </button>
                  </>
                )}
                <button type="button" onClick={() => { setTab('login'); clear(); }} className="w-full text-center text-sm text-slate-400 hover:text-blue-600 transition-colors">
                  ← Voltar para o login
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Sub-componentes ───────────────────────────────────────

function Field({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none text-sm text-slate-900 placeholder:text-slate-300 transition-all"
      />
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle }: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none text-sm text-slate-900 placeholder:text-slate-300 transition-all"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {show ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Erros Firebase traduzidos ─────────────────────────────

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-not-found': 'Nenhuma conta encontrada com esse e-mail.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Esse e-mail já está cadastrado.',
    'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    'auth/popup-closed-by-user': 'Login cancelado.',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
  };
  return map[code] ?? 'Ocorreu um erro. Tente novamente.';
}
