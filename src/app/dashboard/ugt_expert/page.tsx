import { RoleDashboard } from "../_role-dashboard";

export default function Page() {
  return (
    <RoleDashboard
      slug="ugt_expert"
      description="Чек-листы ГОСТ, подписание актов верификации УГТ."
      permissions={["project.view", "doc.verify_report.upload", "doc.verify.sign", "doc.tz.create"]}
    />
  );
}
