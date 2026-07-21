import { RoleDashboard } from "../_role-dashboard";

export default function Page() {
  return (
    <RoleDashboard
      slug="gk_customer"
      description="Создание ПТЗ, мониторинг УГТ, согласование ТЗ/Актов."
      permissions={["project.create", "project.view", "doc.tz.approve", "registry.technology.view", "catalog.executors.view"]}
    />
  );
}
