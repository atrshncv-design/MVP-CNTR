// Проектов пока нет — shell рендерит empty-state через api-client.getProjects (membership)
// Создать первую заявку — CTA в RoleDashboardShell → /dashboard/gk_customer/projects/new
import RoleDashboardShell from '@/features/dashboard/RoleDashboardShell';

export default function Page() {
  return <RoleDashboardShell role="gk_customer" />;
}
