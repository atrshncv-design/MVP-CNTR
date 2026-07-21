import Link from "next/link";
import { auth, signOut } from "@/auth.config";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="font-bold text-gray-900">
              Технозрелость
            </Link>
            {session?.user && (
              <span className="text-sm text-gray-600">
                {session.user.name} · роли: {session.user.roles.join(", ")}
              </span>
            )}
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200"
            >
              Выйти
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}