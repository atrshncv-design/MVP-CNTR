import Link from "next/link";
import { auth } from "@/auth.config";
import { ROLES, ROLE_DASHBOARD, type RoleSlug } from "@/lib/roles";

export default async function Home() {
  const session = await auth();
  const primary = (session?.user?.roles?.[0] as RoleSlug) ?? null;

  return (
    <main className="mx-auto mt-12 max-w-2xl px-4">
      <h1 className="text-3xl font-bold">Платформа «Технозрелость»</h1>
      <p className="mt-3 text-gray-700">
        B2B/B2G-инфраструктура трансфера технологий по ГОСТ Р 58048-2017.
      </p>

      <div className="mt-6 flex gap-3">
        {session?.user ? (
          primary && (
            <Link
              href={ROLE_DASHBOARD[primary]}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Войти в личный кабинет ({primary})
            </Link>
          )
        ) : (
          <>
            <Link href="/login" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Вход
            </Link>
            <Link href="/register" className="rounded border px-4 py-2 hover:bg-gray-100">
              Регистрация
            </Link>
          </>
        )}
      </div>

      {primary && (
        <p className="mt-6 text-sm text-gray-600">
          Всего ролей в системе: {ROLES.length}. Ваш кабинет: {ROLE_DASHBOARD[primary]}.
        </p>
      )}
    </main>
  );
}