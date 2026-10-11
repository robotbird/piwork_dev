import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { JoinDialog } from "@/components/chat/join-dialog";
import { ProjectJoinAction } from "@/components/projects/project-join-action";
import { getMemberByUserId } from "@/lib/db/organization-queries";
import { checkShareInvite } from "@/lib/db/project-share-queries";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const t = await getTranslations("projects");
  const [{ projectId }, { t: token }, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);
  const enabled = session?.user?.id
    ? (await getMemberByUserId(session.user.id))?.status === "enabled"
    : false;
  if (
    !enabled ||
    !z.uuid().safeParse(projectId).success ||
    !token ||
    !(await checkShareInvite(projectId, token))
  ) {
    return (
      <JoinDialog
        description={t("joinInvalidDescription")}
        title={t("joinInvalidTitle")}
      />
    );
  }
  return (
    <JoinDialog description={t("joinDescription")} title={t("joinTitle")}>
      <ProjectJoinAction projectId={projectId} token={token} />
    </JoinDialog>
  );
}
