import { RoleDashboard } from "../_role-dashboard";

export default function Page() {
  return (
    <RoleDashboard
      slug="scientific_org"
      description="Витрина кейсов, работа с Мини-ТЗ (Limited v2)."
      permissions={["project.view", "catalog.executors.view", "doc.tz.create"]}
    />
  );
}
