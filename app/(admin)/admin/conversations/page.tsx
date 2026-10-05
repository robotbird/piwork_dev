import { redirect } from "next/navigation";
import { ConversationsPage } from "@/components/admin/conversations/conversations-page";
import { requireAdminRole } from "@/lib/admin/access";
import { conversationFilters } from "@/lib/admin/conversations";
import { listAdminConversations } from "@/lib/db/conversation-queries";

export default async function ConversationsAdminPage() {
  if (!(await requireAdminRole())) {
    redirect("/");
  }
  const initialData = await listAdminConversations(
    conversationFilters.parse({})
  );
  return <ConversationsPage initialData={initialData} />;
}
