import { SectionPlaceholder } from "@/components/management/section-placeholder";
import { getManagementSection } from "@/lib/management/sections";

const section = getManagementSection("/management/models");

export default function ModelsManagementPage() {
  return <SectionPlaceholder section={section} />;
}
