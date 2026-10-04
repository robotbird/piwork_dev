import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { ProfileView } from "@/components/profile/profile-view";
import { getMemberByUserId } from "@/lib/db/organization-queries";
import { getProfile } from "@/lib/db/profile-queries";

export function SettingsPage({
  section,
}: {
  section: "profile" | "security" | "usage";
}) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <AuthenticatedProfile section={section} />
    </Suspense>
  );
}

async function AuthenticatedProfile({
  section,
}: {
  section: "profile" | "security" | "usage";
}) {
  const session = await auth();
  if (session?.user?.type !== "regular") {
    redirect("/login");
  }
  const member = await getMemberByUserId(session.user.id);
  if (member?.status === "disabled") {
    redirect("/login");
  }
  const profile = await getProfile(session.user.id);
  if (!profile) {
    redirect("/login");
  }
  return <ProfileView key={section} profile={profile} section={section} />;
}
