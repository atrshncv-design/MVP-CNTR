import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FlaskConical, Building2, Shield, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { loginAdmin } from '@/data/adminData';

interface LoginCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgGradient: string;
  onSubmit: (email: string, password: string) => void;
  delay: number;
}

function LoginCard({ icon, title, description, color, bgGradient, onSubmit, delay }: LoginCardProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email, password);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      className="relative flex flex-col rounded-2xl border border-white/10 bg-[#1E293B]/80 p-6 backdrop-blur-xl sm:p-8"
      style={{ boxShadow: `0 8px 32px ${color}15` }}
    >
      <div
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl"
        style={{ background: bgGradient }}
      >
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
      <p className="mb-5 text-sm leading-relaxed text-[#94A3B8]">{description}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <input
          type="text"
          placeholder="Логин"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-white/10 bg-[#0F172A]/80 px-4 py-2.5 text-sm text-white placeholder-[#475569] outline-none transition-colors focus:border-[color:var(--focus-color)] focus:ring-1 focus:ring-[color:var(--focus-color)]"
          style={{ '--focus-color': color } as React.CSSProperties}
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0F172A]/80 px-4 py-2.5 pr-10 text-sm text-white placeholder-[#475569] outline-none transition-colors focus:border-[color:var(--focus-color)] focus:ring-1 focus:ring-[color:var(--focus-color)]"
            style={{ '--focus-color': color } as React.CSSProperties}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          type="submit"
          className="mt-2 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-[0.98]"
          style={{ background: bgGradient }}
        >
          Войти
          <ArrowRight size={16} />
        </button>
      </form>
    </motion.div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdminLogin = (email: string, password: string) => {
    if (!email.trim() || !password.trim()) {
      showToast('Введите логин и пароль');
      return;
    }
    if (email === 'admin' && password === 'admin') {
      loginAdmin();
      navigate('/admin');
    } else {
      showToast('Неверный логин или пароль. Демо-доступ: admin / admin');
    }
  };

  const handlePerformerLogin = () => {
    showToast('Личный кабинет исполнителя в разработке');
  };

  const handleCustomerLogin = () => {
    showToast('Личный кабинет заказчика в разработке');
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#0F172A] px-4 py-12">
      {/* Background gradient effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[#2E5BFF]/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-[#FF7A2E]/10 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5B9BD5]/8 blur-[100px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-[1120px]">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <Link to="/" className="mb-6 inline-block">
            <span className="font-mono text-2xl font-bold tracking-tight text-white">
              ТЕХНОЗРЕЛОСТЬ
            </span>
          </Link>
          <h1 className="mb-3 text-3xl font-bold text-white sm:text-4xl">
            Вход в систему
          </h1>
          <p className="mx-auto max-w-lg text-[#94A3B8]">
            Выберите тип аккаунта и войдите в личный кабинет
          </p>
          <p className="mt-2 text-xs text-[#64748B]">
            Демо-доступ в админку: логин <code className="rounded bg-[#1E293B] px-1.5 py-0.5 text-[#4A82FF]">admin</code>, пароль <code className="rounded bg-[#1E293B] px-1.5 py-0.5 text-[#4A82FF]">admin</code>
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <LoginCard
            icon={<FlaskConical size={28} className="text-white" />}
            title="Я хочу оценить свой проект"
            description="Личный кабинет для исполнителей — научных организаций, ВУЗов, лабораторий и стартапов."
            color="#2E5BFF"
            bgGradient="linear-gradient(135deg, #2E5BFF 0%, #4A82FF 100%)"
            onSubmit={handlePerformerLogin}
            delay={0.1}
          />
          <LoginCard
            icon={<Building2 size={28} className="text-white" />}
            title="Я ищу исполнителя"
            description="Личный кабинет для заказчиков — промышленных компаний и госкорпораций."
            color="#FF7A2E"
            bgGradient="linear-gradient(135deg, #FF7A2E 0%, #E5C840 100%)"
            onSubmit={handleCustomerLogin}
            delay={0.2}
          />
          <LoginCard
            icon={<Shield size={28} className="text-white" />}
            title="Вход для администратора"
            description="Управление исполнителями, заказчиками и аналитика платформы."
            color="#EF4444"
            bgGradient="linear-gradient(135deg, #EF4444 0%, #DC2626 100%)"
            onSubmit={handleAdminLogin}
            delay={0.3}
          />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-10 text-center"
        >
          <Link
            to="/"
            className="text-sm text-[#94A3B8] transition-colors hover:text-white"
          >
            ← Вернуться на главную
          </Link>
        </motion.div>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#1E293B] border border-white/10 px-6 py-3 text-sm text-white shadow-xl"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}
