import { redirect } from "next/navigation";
import { TokenStatisticsPage } from "@/components/admin/token-statistics-page";
import { requireAdminRole } from "@/lib/admin/access";
import { defaultTokenDates, tokenFilters } from "@/lib/admin/token-statistics";
import { getTokenStatistics } from "@/lib/db/token-statistics-queries";

export default async function Page() {
  if (!(await requireAdminRole())) {
    redirect("/");
  }
  const initialData = await getTokenStatistics(
    tokenFilters.parse(defaultTokenDates())
  );
  return <TokenStatisticsPage initialData={initialData} />;
}
