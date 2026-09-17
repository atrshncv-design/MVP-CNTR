import { QuestionnaireWizardClient } from '@/components/questionnaire';
import { OrgVerificationHint, PublishRulesNote } from '@/components/project-create';

/**
 * Создание проекта R&D-исполнителем (таск 01, R02.1): та же анкета УГТ,
 * что у заказчика, плюс подсказка про организацию и правила публикации.
 * Матрица ролей: только rd_executor (см. src/lib/roles.ts).
 */
export default function NewRdExecutorProjectPage() {
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
