import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto mt-24 max-w-md rounded-xl border border-tz-danger bg-tz-danger-soft p-8 text-center">
      <h1 className="mb-2 text-2xl font-bold text-tz-danger">Доступ запрещён</h1>
      <p className="mb-4 text-tz-secondary">
        У вашей роли нет прав на просмотр этого личного кабинета.
      </p>
      <Link href="/dashboard" className="text-tz-accent underline">
        Перейти в мой кабинет
      </Link>
    </main>
  );
}