import { notFound } from "next/navigation";
import { SandboxSettingsPage } from "@/components/admin/sandbox-settings-page";
import { requireAdminRole } from "@/lib/admin/access";
import { getSandboxSettingsView } from "@/lib/admin/sandbox-settings";

export default async function Page() {
  if (!(await requireAdminRole())) {
    notFound();
  }
  return <SandboxSettingsPage initialData={await getSandboxSettingsView()} />;
}
