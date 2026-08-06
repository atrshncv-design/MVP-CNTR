import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

/**
 * T-002. Публичный shell: identity + задача-first навигация (header),
 * контент, футер. Header/футер стабильны при loading/error дочерних
 * страниц (Design.md §12.1, п.1).
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
