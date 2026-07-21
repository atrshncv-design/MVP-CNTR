import { RoleDashboard } from "../_role-dashboard";

export default function Page() {
  return (
    <RoleDashboard
      slug="cntr_admin"
      description="Управление RBAC, логирование, биллинг."
      permissions={["project.view", "project.moderate", "rbac.manage", "billing.manage", "log.view", "registry.technology.manage"]}
    />
  );
}
