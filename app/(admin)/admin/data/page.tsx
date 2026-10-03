"use client";

import { SectionPlaceholder } from "@/components/admin/section-placeholder";
import { getAdminSection } from "@/lib/admin/sections";

const section = getAdminSection("/admin/data");

export default function DataAdminPage() {
  return <SectionPlaceholder section={section} />;
}
