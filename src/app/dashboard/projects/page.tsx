import Link from "next/link";
import { auth } from "@/auth.config";
import { ApiError, getProjects } from "@/lib/api-client";

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  active: "В работе",
  review: "На проверке",
  completed: "Завершён",
};

export default async function ProjectsPage() {
  const session = await auth();
  let projects;

  try {
    projects = await getProjects(session!.user.accessToken);
  } catch (error) {
    const unavailable = error instanceof ApiError && error.status >= 500;
    return (
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-slate-500">
          Проекты
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em]">Не удалось загрузить проекты</h1>
        <div className="mt-7 rounded-[14px] border border-red-200 bg-white p-6">
          <p className="font-semibold text-red-800">
            {unavailable ? "Сервис проектов временно недоступен" : "Нет доступа к данным проектов"}
          </p>
          <p className="mt-2 text-slate-600">
            Обновите страницу позже или обратитесь к менеджеру ЦНТР.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-[#DFE5EC] pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-slate-500">
            Единый рабочий контур
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em]">Проекты</h1>
          <p className="mt-2 text-slate-600">Доступны только проекты в области вашей роли.</p>
        </div>
        {session?.user.roles.includes("gk_customer") && (
          <Link
            href="/dashboard/gk_customer/projects/new"
            className="rounded-lg bg-[#2E5BFF] px-4 py-2.5 font-bold text-white hover:bg-[#244BD9]"
          >
            Создать заявку
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="mt-8 rounded-[14px] border border-[#DFE5EC] bg-white px-6 py-14 text-center">
          <h2 className="text-2xl font-bold">Проектов пока нет</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            В вашей области доступа ещё нет созданных проектов.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/project/${project.id}`}
              className="grid gap-4 rounded-[14px] border border-[#DFE5EC] bg-white p-5 transition hover:border-[#2E5BFF] md:grid-cols-[1fr_auto_auto]"
            >
              <div>
                <div className="font-mono text-xs text-slate-500">ЦНТР-{project.id}</div>
                <h2 className="mt-1 text-lg font-bold">{project.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{project.category ?? "Категория не указана"}</p>
              </div>
              <div className="md:text-right">
                <div className="text-xs text-slate-500">Текущий уровень</div>
                <div className="mt-1 font-bold text-[#2E5BFF]">УГТ {project.current_level}</div>
              </div>
              <div className="md:min-w-28 md:text-right">
                <div className="text-xs text-slate-500">Статус</div>
                <div className="mt-1 font-semibold">{STATUS_LABELS[project.status] ?? project.status}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
