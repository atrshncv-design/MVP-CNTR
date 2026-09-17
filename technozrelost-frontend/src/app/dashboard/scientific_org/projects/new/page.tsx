import { QuestionnaireWizardClient } from '@/components/questionnaire';

/**
 * Создание проекта научной организацией (таск 01, R02.1): та же анкета УГТ,
 * что у заказчика, без дополнительных подсказок (решение владельца).
 * Матрица ролей: только scientific_org (см. src/lib/roles.ts).
 */
export default function NewScientificOrgProjectPage() {
  return <QuestionnaireWizardClient />;
}
