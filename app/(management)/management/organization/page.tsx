import { SectionPlaceholder } from "@/components/management/section-placeholder";
import { getManagementSection } from "@/lib/management/sections";

const section = getManagementSection("/management/organization");

export default function OrganizationManagementPage() {
  return <SectionPlaceholder section={section} />;
}
