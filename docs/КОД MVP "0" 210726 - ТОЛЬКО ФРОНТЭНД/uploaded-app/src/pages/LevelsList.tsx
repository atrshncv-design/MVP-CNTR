import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  FileText,
  Beaker,
  ArrowRight,
} from 'lucide-react';
import { UGT_LEVELS } from '@/data/ugtData';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

const heroVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

function getKpiIcon(label: string): typeof BookOpen {
  if (label.includes('Публикации')) return BookOpen;
  if (label.includes('Патенты')) return FileText;
  return Beaker;
}

export default function LevelsList() {
  return (
    <>
      {/* Hero Section */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0F172A 0%, #1a2744 50%, #F5F7FA 100%)' }}
      >
        <div className="mx-auto max-w-[1280px] px-4 pt-[140px] pb-24 sm:px-6 lg:px-8 sm:pb-32">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="text-center"
          >
            <motion.div variants={heroVariants}>
              <span
                className="inline-block rounded-full px-4 py-1.5 font-mono text-sm font-semibold"
                style={{
                  background: 'rgba(46, 91, 255, 0.15)',
                  color: '#4A82FF',
                  border: '1px solid rgba(46, 91, 255, 0.3)',
                }}
              >
                ГОСТ Р 58048-2017
              </span>
            </motion.div>

            <motion.h1
              variants={heroVariants}
              className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-[56px] lg:leading-[1.1]"
              style={{ letterSpacing: '-0.02em' }}
            >
              Уровни готовности технологии
            </motion.h1>

            <motion.p
              variants={heroVariants}
              className="mx-auto mt-6 max-w-[640px] text-lg leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              Девять уровней от базовых принципов до успешной эксплуатации — оцените
              технологическое развитие вашего проекта
            </motion.p>

            {/* Mini gradient bar */}
            <motion.div
              variants={heroVariants}
              className="mx-auto mt-10 flex h-2 max-w-[600px] overflow-hidden rounded-full"
            >
              {UGT_LEVELS.map((level) => (
                <div
                  key={level.id}
                  className="h-full flex-1"
                  style={{ backgroundColor: level.color }}
                />
              ))}
            </motion.div>
            <motion.div
              variants={heroVariants}
              className="mx-auto mt-2 flex max-w-[600px] justify-between"
            >
              {UGT_LEVELS.map((level) => (
                <span
                  key={level.id}
                  className="font-mono text-[10px] font-medium"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  {level.id}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Cards Grid Section */}
      <section className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={containerVariants}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {UGT_LEVELS.map((level) => {
            const kpiEntries = Object.entries(level.kpi);
            return (
              <motion.div key={level.id} variants={itemVariants}>
                <Link
                  to={`/level/${level.id}`}
                  className="group block h-full"
                >
                  <div
                    className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#E8ECF0] bg-white p-6 transition-all duration-300 sm:p-7"
                    style={{
                      boxShadow:
                        '0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 4px rgba(15, 23, 42, 0.04)',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.borderColor = level.color + '40';
                      el.style.transform = 'translateY(-4px)';
                      el.style.boxShadow =
                        '0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.borderColor = '#E8ECF0';
                      el.style.transform = 'translateY(0)';
                      el.style.boxShadow =
                        '0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 4px rgba(15, 23, 42, 0.04)';
                    }}
                  >
                    {/* Top accent border */}
                    <div
                      className="absolute left-0 right-0 top-0 h-[3px]"
                      style={{ backgroundColor: level.color }}
                    />

                    {/* UGT Code Badge */}
                    <div className="flex items-center justify-between">
                      <span
                        className="inline-block rounded-full px-3 py-1 font-mono text-sm font-semibold"
                        style={{
                          background: level.color + '18',
                          color: level.color,
                          border: `1px solid ${level.color}30`,
                        }}
                      >
                        {level.code}
                      </span>
                      <ArrowRight
                        size={18}
                        className="text-[#94A3B8] transition-all duration-300 group-hover:translate-x-1"
                        style={{ groupHover: { color: level.color } } as React.CSSProperties}
                      />
                    </div>

                    {/* Name */}
                    <h3 className="mt-4 text-xl font-semibold text-[#0F172A] sm:text-2xl">
                      {level.name}
                    </h3>

                    {/* Short description */}
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[#475569] sm:text-base">
                      {level.short}
                    </p>

                    {/* Divider */}
                    <div className="my-4 h-px w-full bg-[#E8ECF0]" />

                    {/* KPI Stats */}
                    <div className="flex flex-wrap gap-3">
                      {kpiEntries.map(([label, value]) => {
                        const Icon = getKpiIcon(label);
                        return (
                          <div
                            key={label}
                            className="flex items-center gap-1.5 rounded-md bg-[#F5F7FA] px-2.5 py-1.5"
                          >
                            <Icon
                              size={14}
                              style={{ color: level.color }}
                            />
                            <span className="font-mono text-xs font-medium text-[#475569]">
                              {value}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
          }}
          className="mt-16 text-center"
        >
          <p className="text-base text-[#475569]">
            Не знаете, какой уровень соответствует вашему проекту?{' '}
            <Link
              to="/assessment"
              className="inline-flex items-center gap-1 font-medium text-[#2E5BFF] transition-colors duration-200 hover:text-[#4A82FF] hover:underline"
            >
              Пройти оценку
              <ArrowRight size={16} />
            </Link>
          </p>
        </motion.div>
      </section>
    </>
  );
}
