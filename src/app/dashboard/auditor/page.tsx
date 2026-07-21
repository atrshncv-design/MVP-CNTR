import { RoleDashboard } from "../_role-dashboard";

export default function Page() {
  return (
    <RoleDashboard
      slug="auditor"
      description="Доступ к ТЭО и Паспорту, решение go/no-go по КТ-1."
      permissions={["project.view", "audit.kt1.decide", "doc.passport.generate", "doc.teo.generate"]}
    />
  );
}
