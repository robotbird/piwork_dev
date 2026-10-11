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
        description="请使用启用的同事账号登录，并确认分享链接未过期或撤销。"
        title="无法加入项目"
      />
    );
  }
  return (
    <JoinDialog
      description="加入后可查看项目资料并创建自己的对话。各自的对话保持私有。"
      title="加入共享项目"
    >
      <ProjectJoinAction projectId={projectId} token={token} />
    </JoinDialog>
  );
}
