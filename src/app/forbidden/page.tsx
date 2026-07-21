import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto mt-24 max-w-md rounded-xl border border-red-200 bg-red-50 p-8 text-center">
      <h1 className="mb-2 text-2xl font-bold text-red-700">Доступ запрещён</h1>
      <p className="mb-4 text-gray-700">
        У вашей роли нет прав на просмотр этого личного кабинета.
      </p>
      <Link href="/dashboard" className="text-blue-600 underline">
        Перейти в мой кабинет
      </Link>
    </main>
  );
}