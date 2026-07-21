import { RoleDashboard } from "../_role-dashboard";

export default function Page() {
  return (
    <RoleDashboard
      slug="serial_manufacturer"
      description="Каталог КД, запрос лицензий, приёмка в серию (УГТ 7+)."
      permissions={["project.view", "registry.technology.view", "catalog.executors.view"]}
    />
  );
}
