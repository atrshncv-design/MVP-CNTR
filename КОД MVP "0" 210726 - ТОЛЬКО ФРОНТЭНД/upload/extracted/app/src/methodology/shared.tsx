import { type ReactNode, type ElementType } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';

/* ================================================================== */
/*  Animation helpers                                                  */
/* ================================================================== */

export const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];
export const easeSmooth = [0.4, 0, 0.2, 1] as [number, number, number, number];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: easeOutExpo },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: easeOutExpo },
  },
};

/* ================================================================== */
/*  Helper: Section Header                                            */
/* ================================================================== */

export function SectionHeader({
  label, title, subtitle, dark = false,
}: {
  label: string; title: string; subtitle?: string; dark?: boolean;
}) {
  return (
    <motion.div className="mb-10" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}>
      <span className="mb-3 block text-xs font-medium uppercase tracking-[0.05em]" style={{ color: dark ? 'rgba(255,255,255,0.4)' : '#94A3B8' }}>
        {label}
      </span>
      <h2 className="text-3xl font-bold tracking-tight sm:text-[40px]" style={{ color: dark ? '#FFFFFF' : '#0F172A', lineHeight: 1.15, letterSpacing: '-0.015em' }}>
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 max-w-[700px] text-lg" style={{ color: dark ? 'rgba(255,255,255,0.65)' : '#475569', lineHeight: 1.65 }}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}

/* ================================================================== */
/*  Info Block — reusable definition card                               */
/* ================================================================== */

export function InfoBlock({ icon: Icon, title, children, variant = 'light' }: { icon: ElementType; title: string; children: ReactNode; variant?: 'light' | 'dark' }) {
  const bg = variant === 'dark' ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const border = variant === 'dark' ? 'rgba(255,255,255,0.1)' : '#E8ECF0';
  const titleColor = variant === 'dark' ? '#FFFFFF' : '#0F172A';
  const textColor = variant === 'dark' ? 'rgba(255,255,255,0.7)' : '#475569';
  const iconColor = variant === 'dark' ? '#4A82FF' : '#2E5BFF';

  return (
    <motion.div className="mb-8 rounded-[10px] border p-5 sm:p-6" style={{ backgroundColor: bg, borderColor: border }} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: iconColor + '15' }}>
          <Icon size={20} style={{ color: iconColor }} />
        </div>
        <div>
          <h3 className="mb-2 text-base font-semibold sm:text-lg" style={{ color: titleColor }}>{title}</h3>
          <div className="text-sm leading-relaxed" style={{ color: textColor, lineHeight: 1.7 }}>{children}</div>
        </div>
      </div>
    </motion.div>
  );
}
