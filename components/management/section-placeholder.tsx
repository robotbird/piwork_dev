import { Badge } from "@/components/ui/badge";
import type { ManagementSection } from "@/lib/management/sections";

export function SectionPlaceholder({
  section,
}: {
  section: ManagementSection;
}) {
  const Icon = section.icon;

  return (
    <main className="min-w-0 px-5 py-8 sm:px-8 md:px-12 md:py-14 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <header>
          <div className="flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-border bg-card text-primary">
              <Icon className="size-5" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-heading-lg">{section.title}</h1>
              {section.ready ? null : <Badge variant="secondary">建设中</Badge>}
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {section.tagline}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            {section.description}
          </p>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {section.features.map((feature) => (
            <div
              className="rounded-xl border border-border bg-card p-5"
              key={feature}
            >
              <h2 className="text-[15px] font-medium">{feature}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                UI 结构已就位，功能待实现
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
