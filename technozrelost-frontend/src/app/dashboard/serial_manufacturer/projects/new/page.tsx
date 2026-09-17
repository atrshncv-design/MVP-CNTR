import { QuestionnaireWizardClient } from '@/components/questionnaire';
import { OrgVerificationHint, PublishRulesNote } from '@/components/project-create';

/**
 * Создание проекта серийным производителем (таск 01, R02.1): та же анкета УГТ,
 * что у заказчика, плюс подсказка про организацию и правила публикации.
 * Матрица ролей: только serial_manufacturer (см. src/lib/roles.ts).
 */
export default function NewSerialManufacturerProjectPage() {
  return (
    <QuestionnaireWizardClient
      topSlot={
        <>
          <OrgVerificationHint />
          <PublishRulesNote />
        </>
      }
    />
  );
}
