'use client';

import { motion } from 'framer-motion';
import { FolderKanban, Upload, ArrowRight, Building2, Users, FileCheck, Activity } from 'lucide-react';
import Link from 'next/link';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const easeOut = [0.16, 1, 0.3, 1] as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOut },
  },
};

const statCards = [
  { label: 'Активные проекты', value: '3', color: '#2E5BFF', icon: Activity },
  { label: 'На согласовании', value: '2', color: '#E5C840', icon: FileCheck },
  { label: 'Эксперты', value: '12', color: '#10B981', icon: Users },
  { label: 'Исполнители', value: '8', color: '#FF7A2E', icon: Building2 },
];

export default function GkCustomerDashboard() {
  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      {/* Hero Header */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1a2744 100%)' }}
      >
        <div className="mx-auto max-w-[1280px] px-4 pt-[100px] pb-16 sm:px-6 lg:px-8 sm:pb-20">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants}>
              <span
                className="inline-block rounded-full px-4 py-1.5 font-mono text-sm font-semibold"
                style={{
                  background: 'rgba(46, 91, 255, 0.15)',
                  color: '#4A82FF',
                  border: '1px solid rgba(46, 91, 255, 0.3)',
                }}
              >
                ГосКомпания • Заказчик
              </span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[44px] lg:leading-[1.1]"
            >
              Управление технологическими проектами
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mx-auto mt-4 max-w-[560px] text-base leading-relaxed sm:text-lg"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              Создавайте проекты, оценивайте уровень готовности технологий (УГТ)
              по ГОСТ Р 58048-2017 и контролируйте исполнение
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6 lg:px-8" style={{ marginTop: '-40px' }}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="grid grid-cols-1 gap-6 md:grid-cols-2"
        >
          {/* Создание проекта */}
          <motion.div variants={itemVariants}>
            <Link href="/dashboard/gk_customer/projects" className="group block">
              <div
                className="relative overflow-hidden rounded-2xl border border-[#E8ECF0] bg-white p-8 transition-all duration-300 hover:-translate-y-1"
                style={{
                  boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(46, 91, 255, 0.12), 0 4px 12px rgba(15, 23, 42, 0.06)';
                  e.currentTarget.style.borderColor = '#2E5BFF40';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(15, 23, 42, 0.06)';
                  e.currentTarget.style.borderColor = '#E8ECF0';
                }}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{
                      background: 'linear-gradient(135deg, #2E5BFF, #4A82FF)',
                      boxShadow: '0 4px 12px rgba(46, 91, 255, 0.25)',
                    }}
                  >
                    <FolderKanban size={28} className="text-white" />
                  </div>
                  <ArrowRight
                    size={20}
                    className="text-[#94A3B8] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#2E5BFF]"
                  />
                </div>
                <h2 className="mt-6 text-2xl font-bold" style={{ color: '#0F172A' }}>
                  Создание проекта
                </h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: '#475569' }}>
                  Создайте новый проект и оцените текущий уровень готовности технологии
                  по методике ГОСТ Р 58048-2017. Заполните опросник по 9 уровням УГТ
                  и получите детальную оценку.
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium" style={{ color: '#2E5BFF' }}>
                  <span>Начать оценку</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Загрузка ТЗ */}
          <motion.div variants={itemVariants}>
            <Link href="/dashboard/gk_customer/upload-tz" className="group block">
              <div
                className="relative overflow-hidden rounded-2xl border border-[#E8ECF0] bg-white p-8 transition-all duration-300 hover:-translate-y-1"
                style={{
                  boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(255, 122, 46, 0.12), 0 4px 12px rgba(15, 23, 42, 0.06)';
                  e.currentTarget.style.borderColor = '#FF7A2E40';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(15, 23, 42, 0.06)';
                  e.currentTarget.style.borderColor = '#E8ECF0';
                }}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{
                      background: 'linear-gradient(135deg, #FF7A2E, #FF9A5E)',
                      boxShadow: '0 4px 12px rgba(255, 122, 46, 0.25)',
                    }}
                  >
                    <Upload size={28} className="text-white" />
                  </div>
                  <ArrowRight
                    size={20}
                    className="text-[#94A3B8] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#FF7A2E]"
                  />
                </div>
                <h2 className="mt-6 text-2xl font-bold" style={{ color: '#0F172A' }}>
                  Загрузка ТЗ
                </h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: '#475569' }}>
                  Загрузите техническое задание на разработку технологии для
                  автоматического анализа и определения начального уровня УГТ.
                  Система выполнит предварительную оценку.
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium" style={{ color: '#FF7A2E' }}>
                  <span>Загрузить документ</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          </motion.div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                variants={itemVariants}
                className="rounded-2xl border border-[#E8ECF0] bg-white p-5 transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: `${stat.color}15` }}
                  >
                    <Icon size={18} style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: '#0F172A' }}>{stat.value}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>{stat.label}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
