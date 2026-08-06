import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Factory,
  Activity,
  BarChart3,
  Plus,
  TrendingUp,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { getPerformers, getCustomers, getPriorityColor } from '@/data/adminData';
import type { Performer, Customer } from '@/data/adminData';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl border border-white/10 bg-[#1E293B]/80 p-5 backdrop-blur-sm"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#94A3B8]">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-[#475569]">{subtitle}</p>}
        </div>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-lg"
          style={{ background: `${color}18` }}
        >
          <Icon size={22} style={{ color }} />
        </div>
      </div>
    </motion.div>
  );
}

function RecentItem({
  item,
  type,
}: {
  item: (Performer | Customer) & { entityType: string };
  type: string;
}) {
  const navigate = useNavigate();
  const isPerformer = type === 'performer';
  const color = isPerformer ? '#2E5BFF' : '#FF7A2E';

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"
      onClick={() =>
        navigate(`/admin/${isPerformer ? 'performers' : 'customers'}/${item.id}`)
      }
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white"
            style={{ background: color }}
          >
            {isPerformer ? 'И' : 'З'}
          </div>
          <span className="text-sm font-medium text-white">{item.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            background: `${getPriorityColor(item.priority as 'Высокий' | 'Средний' | 'Низкий')}18`,
            color: getPriorityColor(item.priority as 'Высокий' | 'Средний' | 'Низкий'),
          }}
        >
          {item.priority}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-[#94A3B8]">
        {'currentUGT' in item ? `УГТ ${item.currentUGT}` : (item as Customer).industry}
      </td>
      <td className="px-4 py-3 text-right text-xs text-[#475569]">
        {new Date(item.createdAt).toLocaleDateString('ru-RU')}
      </td>
    </motion.tr>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const performers = useMemo(() => getPerformers(), []);
  const customers = useMemo(() => getCustomers(), []);

  const totalPerformers = performers.length;
  const totalCustomers = customers.length;
  const activeProjects = performers.filter((p) => p.status === 'Активный').length;
  const avgUGT =
    performers.length > 0
      ? (performers.reduce((s, p) => s + p.currentUGT, 0) / performers.length).toFixed(1)
      : '0';

  // UGT distribution chart data
  const ugtData = useMemo(() => {
    const counts = Array.from({ length: 9 }, (_, i) => ({
      level: `УГТ ${i + 1}`,
      count: performers.filter((p) => p.currentUGT === i + 1).length,
      color: ['#2E5BFF', '#3B6CFF', '#4A82FF', '#5B9BD5', '#6AB0B5', '#7EC8A0', '#A8D65A', '#E5C840', '#FF7A2E'][i],
    }));
    return counts;
  }, [performers]);

  // Recent items (combine and sort by createdAt)
  const recentItems = useMemo(() => {
    const combined = [
      ...performers.map((p) => ({ ...p, entityType: 'performer' as const })),
      ...customers.map((c) => ({ ...c, entityType: 'customer' as const })),
    ];
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return combined.slice(0, 5);
  }, [performers, customers]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Дашборд</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Обзор платформы УГТ — исполнители, заказчики и аналитика
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/admin/performers', { state: { openAdd: true } })}
            className="flex items-center gap-2 rounded-lg bg-[#2E5BFF] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#2548CC] hover:shadow-lg active:scale-[0.98]"
          >
            <Plus size={16} />
            Добавить исполнителя
          </button>
          <button
            onClick={() => navigate('/admin/customers', { state: { openAdd: true } })}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#1E293B] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/5 active:scale-[0.98]"
          >
            <Plus size={16} />
            Добавить заказчика
          </button>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Всего исполнителей"
          value={totalPerformers}
          icon={GraduationCap}
          color="#2E5BFF"
          subtitle="Научные организации и ВУЗы"
        />
        <StatCard
          label="Всего заказчиков"
          value={totalCustomers}
          icon={Factory}
          color="#FF7A2E"
          subtitle="Промышленные компании"
        />
        <StatCard
          label="Активных проектов"
          value={activeProjects}
          icon={Activity}
          color="#10B981"
          subtitle="В работе на данный момент"
        />
        <StatCard
          label="Средний УГТ"
          value={avgUGT}
          icon={BarChart3}
          color="#5B9BD5"
          subtitle="Средний уровень готовности"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Chart */}
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-white/10 bg-[#1E293B]/80 p-5 backdrop-blur-sm lg:col-span-3"
        >
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#2E5BFF]" />
            <h2 className="text-base font-semibold text-white">
              Распределение исполнителей по уровням УГТ
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ugtData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="level"
                tick={{ fill: '#94A3B8', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#94A3B8', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#1E293B',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {ugtData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Recent additions */}
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-white/10 bg-[#1E293B]/80 p-5 backdrop-blur-sm lg:col-span-2"
        >
          <div className="mb-4 flex items-center gap-2">
            <Clock size={18} className="text-[#5B9BD5]" />
            <h2 className="text-base font-semibold text-white">Последние добавления</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs font-medium text-[#94A3B8]">
                  <th className="px-4 py-2">Название</th>
                  <th className="px-4 py-2">Приоритет</th>
                  <th className="px-4 py-2">Детали</th>
                  <th className="px-4 py-2 text-right">Дата</th>
                </tr>
              </thead>
              <tbody>
                {recentItems.map((item) => (
                  <RecentItem key={item.id} item={item} type={item.entityType} />
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
