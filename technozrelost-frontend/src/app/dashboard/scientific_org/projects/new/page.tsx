import { QuestionnaireWizardClient } from '@/components/questionnaire';
import { OrgVerificationHint, PublishRulesNote } from '@/components/project-create';

/**
 * Создание проекта научной организацией (таск 01, R02.1): та же анкета УГТ,
 * что у заказчика, плюс подсказка про организацию и правила публикации.
 * Матрица ролей: только scientific_org (см. src/lib/roles.ts).
 */
export default function NewScientificOrgProjectPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-8">
        <div className="grid gap-3">
          <OrgVerificationHint />
          <PublishRulesNote />
        </div>
      </div>
      <QuestionnaireWizardClient />
    </>
  );
}
