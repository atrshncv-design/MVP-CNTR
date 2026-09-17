import { QuestionnaireWizardClient } from '@/components/questionnaire';

/**
 * Создание проекта R&D-исполнителем (таск 01, R02.1): та же анкета УГТ,
 * что у заказчика, без дополнительных подсказок (решение владельца).
 * Матрица ролей: только rd_executor (см. src/lib/roles.ts).
 */
export default function NewRdExecutorProjectPage() {
  return <QuestionnaireWizardClient />;
}
