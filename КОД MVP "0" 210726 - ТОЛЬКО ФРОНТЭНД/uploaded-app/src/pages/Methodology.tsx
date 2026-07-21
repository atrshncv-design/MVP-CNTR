import HeroSection from '@/methodology/HeroSection';
import UGTLevelsSection from '@/methodology/UGTLevelsSection';
import UGPLevelsSection from '@/methodology/UGPLevelsSection';
import UGILevelsSection from '@/methodology/UGILevelsSection';
import UGSLevelsSection from '@/methodology/UGSLevelsSection';
import QuestionnaireCalculatorSection from '@/methodology/QuestionnaireSection';
import UGSCalculatorSection from '@/methodology/UGSCalculatorSection';
import OGPDirectionsSection from '@/methodology/OGPDirectionsSection';
import ProcessSections from '@/methodology/ProcessSections';

export default function Methodology() {
  return (
    <>
      <HeroSection />
      <UGTLevelsSection />
      <UGPLevelsSection />
      <UGILevelsSection />
      <UGSLevelsSection />
      <QuestionnaireCalculatorSection />
      <UGSCalculatorSection />
      <OGPDirectionsSection />
      <ProcessSections />
    </>
  );
}
