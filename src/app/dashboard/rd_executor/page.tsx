import { RoleDashboard } from "../_role-dashboard";

export default function Page() {
  return (
    <RoleDashboard
      slug="rd_executor"
      description="Профиль (УГТ 3-6), загрузка технических отчётов, исполнение НИОКР."
      permissions={["project.view", "doc.tz.create", "doc.verify_report.upload", "registry.technology.view"]}
    />
  );
}
