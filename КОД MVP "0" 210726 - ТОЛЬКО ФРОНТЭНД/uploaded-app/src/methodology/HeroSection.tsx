import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { easeOutExpo } from './shared';

export default function HeroSection() {
  const quickNavPills = [
    { label: 'Шкала УГТ', href: '#ugt-levels' },
    { label: 'Шкала УГП', href: '#ugp-levels' },
    { label: 'Шкала УГИ', href: '#ugi-levels' },
    { label: 'Шкала УГС', href: '#ugs-levels' },
    { label: 'Опросник', href: '#questionnaire' },
    { label: 'Алгоритм УГС', href: '#ugs-calculator' },
    { label: 'Направления ОГП', href: '#ogp-directions' },
    { label: 'Процесс оценки', href: '#assessment-process' },
    { label: 'Матрица соответствия', href: '#correspondence' },
  ];

  const scrollToSection = (href: string) => {
    const id = href.replace('#', '');
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // Navbar height
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0c1222 0%, #0F172A 40%, #1a2744 100%)' }}>
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(46,91,255,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(255,122,46,0.1) 0%, transparent 50%)' }} />
      <div className="relative mx-auto max-w-[1280px] px-4 pb-20 pt-[120px] sm:px-6 lg:px-8">
        <motion.div className="mb-4 flex items-center gap-2 text-sm" style={{ color: '#94A3B8' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4 }}>
          <Link to="/" className="transition-colors duration-200 hover:text-white">Главная</Link>
          <ArrowRight size={14} />
          <span>Методология</span>
        </motion.div>
        <motion.div className="mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4, ease: easeOutExpo }}>
          <span className="inline-block rounded-full border px-5 py-2 font-mono text-sm font-medium" style={{ backgroundColor: 'rgba(46, 91, 255, 0.15)', borderColor: 'rgba(46, 91, 255, 0.3)', color: '#4A82FF', letterSpacing: '0.05em' }}>
            ГОСТ Р 58048-2017
          </span>
        </motion.div>
        <motion.h1 className="max-w-[900px] text-4xl font-bold tracking-tight text-white sm:text-[56px]" style={{ lineHeight: 1.1, letterSpacing: '-0.02em' }} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6, ease: easeOutExpo }}>
          Методология оценки уровня готовности технологий
        </motion.h1>
        <motion.p className="mt-6 max-w-[800px] text-lg" style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5, ease: easeOutExpo }}>
          ГОСТ Р 58048-2017 — Методические указания по оценке уровня зрелости технологий
        </motion.p>
        <motion.p className="mt-4 max-w-[700px] text-base" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5, ease: easeOutExpo }}>
          Межгосударственный стандарт, устанавливающий единую методологию оценки готовности технологий (ОГТ), готовности производства (ОГП), готовности интеграции (ОГИ) и готовности системы (ОГС) для принятия решений о трансфере технологий и управления НИОКР.
        </motion.p>
        <motion.div className="mt-10 flex flex-wrap gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.3 }}>
          {quickNavPills.map((pill, i) => (
            <motion.button key={pill.href} onClick={() => scrollToSection(pill.href)} className="cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-white/[0.12]" style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.05, duration: 0.3 }}>
              {pill.label}
            </motion.button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
