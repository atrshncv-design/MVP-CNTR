import { AchievementsCollection } from "@/components/achievements-collection";

export default function AchievementsPage() {
  return <section><p className="tz-eyebrow">Коллекция подтверждённого опыта</p><h1 className="tz-page-title mt-2">Достижения</h1><p className="mt-2 max-w-2xl text-tz-secondary">Медали за подтверждённые документы, командные переходы по УГТ и завершённые этапы проектов.</p><div className="mt-8 max-w-5xl"><AchievementsCollection /></div></section>;
}
