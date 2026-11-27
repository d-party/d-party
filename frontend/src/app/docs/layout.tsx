import { DocsNav } from "@/components/docs/DocsNav";

export default function DocsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
      <div className="rounded-lg border border-border bg-card p-3 lg:sticky lg:top-6 lg:self-start lg:border-0 lg:bg-transparent lg:p-0">
        <DocsNav />
      </div>
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </div>
  );
}
