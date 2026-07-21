import { auth } from "@/auth.config";
import { ROLES } from "@/lib/roles";

export function RoleDashboard({
  slug,
  description,
  permissions,
}: {
  slug: string;
  description: string;
  permissions: string[];
}) {
  return (
    <section>
      <h1 className="text-2xl font-bold">
        Личный кабинет: {ROLES.find((r) => r.slug === slug)?.name}
      </h1>
      <p className="mt-2 text-gray-700">{description}</p>
      <h2 className="mt-6 text-lg font-semibold">Доступные действия (RBAC)</h2>
      <ul className="mt-2 list-disc pl-6 text-gray-800">
        {permissions.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </section>
  );
}

export async function requireRoleOnServer(slug: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, reason: "unauthorized" };
  if (!session.user.roles.includes(slug)) {
    return { ok: false as const, reason: "forbidden" };
  }
  return { ok: true as const };
}