import { RoleDashboard } from "../_role-dashboard";

export default function Page() {
  return (
    <RoleDashboard
      slug="investor"
      description="Фильтры реестра технологий, аналитика зрелости."
      permissions={["project.view", "registry.technology.view"]}
    />
  );
}
