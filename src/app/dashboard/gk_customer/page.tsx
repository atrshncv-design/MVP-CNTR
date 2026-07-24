import Link from "next/link";
import { auth } from "@/auth.config";

export default async function GkCustomerDashboard() {
  const session = await auth();
  const displayName = session?.user.name ?? session?.user.email ?? "Представитель организации";

  return (
    <section>
      <div className="border-b border-[#DFE5EC] pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-slate-500">
          Рабочий стол заказчика
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#0F172A]">
          Добро пожаловать, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Здесь появятся проекты вашей организации и их путь от заявки до
          внедрения технологии.
        </p>
      </div>

      <nav aria-label="Разделы рабочего стола" className="flex gap-6 border-b border-[#DFE5EC]">
        <span className="border-b-2 border-[#2E5BFF] py-4 font-semibold text-[#0F172A]">
          Проекты
        </span>
        <Link href="/dashboard/gk_customer/projects/new" className="py-4 text-slate-600 hover:text-[#0F172A]">
          Новая заявка
        </Link>
        <Link href="/dashboard/technologies" className="py-4 text-slate-600 hover:text-[#0F172A]">
          Реестр технологий
        </Link>
      </nav>

      <div className="mt-8 rounded-[14px] border border-[#DFE5EC] bg-white px-6 py-14 text-center sm:px-10">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#EAF0FF] font-mono font-bold text-[#2E5BFF]">
          01
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-[-0.02em] text-[#0F172A]">
          Проектов пока нет
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          Начните с фиксированной заявки. После сохранения она станет карточкой
          проекта и будет передана менеджеру ЦНТР на рассмотрение.
        </p>
        <Link
          href="/dashboard/gk_customer/projects/new"
          className="mt-7 inline-flex rounded-lg bg-[#2E5BFF] px-5 py-3 font-bold text-white transition hover:bg-[#244BD9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E5BFF]"
        >
          Создать первую заявку
        </Link>
      </div>
    </section>
  );
}
