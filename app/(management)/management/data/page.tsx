"use client";

import { SectionPlaceholder } from "@/components/management/section-placeholder";
import { getManagementSection } from "@/lib/management/sections";

const section = getManagementSection("/management/data");

export default function DataManagementPage() {
  return <SectionPlaceholder section={section} />;
}
