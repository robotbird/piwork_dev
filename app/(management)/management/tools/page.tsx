"use client";

import { SectionPlaceholder } from "@/components/management/section-placeholder";
import { getManagementSection } from "@/lib/management/sections";

const section = getManagementSection("/management/tools");

export default function ToolsManagementPage() {
  return <SectionPlaceholder section={section} />;
}
