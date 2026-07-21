import { RoleDashboard } from "../_role-dashboard";

export default function Page() {
  return (
    <RoleDashboard
      slug="cntr_manager"
      description="Оркестрация проектов, модерация пайплайна, валидация ИИ."
      permissions={["project.view", "project.moderate", "ai.validate", "project.create", "doc.tz.create", "doc.passport.generate", "doc.teo.generate"]}
    />
  );
}
