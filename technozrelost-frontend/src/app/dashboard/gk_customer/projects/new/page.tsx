import { QuestionnaireWizardClient } from '@/components/questionnaire';
import { OrgVerificationHint, PublishRulesNote } from '@/components/project-create';

export default function NewProjectPage() {
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
