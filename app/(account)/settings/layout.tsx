import { Suspense } from "react";
import { SettingsSidebar } from "@/components/profile/settings-sidebar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground md:flex-row">
      <Suspense fallback={<aside className="md:w-65" />}>
        <SettingsSidebar />
      </Suspense>
      {children}
    </div>
  );
}
