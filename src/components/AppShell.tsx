import { MobileNav, SidebarNav } from "@/components/AppNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f1f3ee] text-[#181917]">
      <MobileNav />
      <div className="flex min-h-screen w-full">
        <SidebarNav />
        <section className="flex min-w-0 flex-1 flex-col">{children}</section>
      </div>
    </main>
  );
}

export function AppHeader({
  title,
  eyebrow = "Ingegneria del Software",
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dfded6] bg-[#fbfbf8] px-5 py-4 md:px-8">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#667064]">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
      </div>
      {action}
    </header>
  );
}
