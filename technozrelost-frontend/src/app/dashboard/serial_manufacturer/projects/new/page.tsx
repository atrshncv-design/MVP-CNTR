import { QuestionnaireWizardClient } from '@/components/questionnaire';

/**
 * Создание проекта серийным производителем (таск 01, R02.1): та же анкета УГТ,
 * что у заказчика, без дополнительных подсказок (решение владельца).
 * Матрица ролей: только serial_manufacturer (см. src/lib/roles.ts).
 */
export default function NewSerialManufacturerProjectPage() {
  return <QuestionnaireWizardClient />;
}
