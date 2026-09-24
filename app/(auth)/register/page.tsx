"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { AuthForm } from "@/components/chat/auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { toast } from "@/components/chat/toast";
import { usePreferences } from "@/components/preferences-provider";
import { type RegisterActionState, register } from "../actions";

export default function Page() {
  const { t } = usePreferences();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    { status: "idle" }
  );

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router and updateSession are stable refs
  useEffect(() => {
    if (state.status === "user_exists") {
      toast({
        description: t("auth.accountAlreadyExists"),
        type: "error",
      });
    } else if (state.status === "failed") {
      toast({
        description: t("auth.failedToCreateAccount"),
        type: "error",
      });
    } else if (state.status === "invalid_data") {
      toast({
        description: t("auth.failedValidatingYourSubmission"),
        type: "error",
      });
    } else if (state.status === "success") {
      toast({
        description: t("auth.accountCreated"),
        type: "success",
      });
      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
  }, [state.status, t]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <>
      <h1 className="text-heading-lg">{t("auth.createAccount")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("auth.getStartedForFree")}
      </p>
      <AuthForm action={handleSubmit} defaultEmail={email}>
        <SubmitButton isSuccessful={isSuccessful}>
          {t("auth.signUp")}
        </SubmitButton>
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.confirmHaveAnAccount")}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href="/login"
          >
            {t("auth.signIn")}
          </Link>
        </p>
      </AuthForm>
    </>
  );
}
