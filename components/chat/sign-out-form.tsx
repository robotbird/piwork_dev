import Form from "next/form";
import { getTranslations } from "next-intl/server";

import { signOut } from "@/app/(auth)/auth";

async function signOutAction() {
  "use server";

  await signOut({
    redirectTo: "/",
  });
}

export async function SignOutForm() {
  const t = await getTranslations("chat");
  return (
    <Form action={signOutAction} className="w-full">
      <button
        className="w-full px-1 py-0.5 text-left text-red-500"
        type="submit"
      >
        {t("signOut")}
      </button>
    </Form>
  );
}
