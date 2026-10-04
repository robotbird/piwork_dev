"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";

import { AuthForm } from "@/components/chat/auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { toast } from "@/components/chat/toast";
import { usePreferences } from "@/components/preferences-provider";
import { type LoginActionState, login } from "../actions";

export default function Page() {
  const { t } = usePreferences();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    { status: "idle" }
  );

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router and updateSession are stable refs
  useEffect(() => {
    if (state.status === "failed") {
      toast({
        description: t("auth.invalidCredentials"),
        type: "error",
      });
    } else if (state.status === "invalid_data") {
      toast({
        description: t("auth.failedValidatingYourSubmission"),
        type: "error",
      });
    } else if (state.status === "success") {
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
      <h1 className="text-[34px] font-semibold leading-tight tracking-tight sm:text-[38px]">
        {t("auth.welcomeLogin")}
      </h1>
      <p className="text-lg leading-relaxed text-[#8490aa]">
        {t("auth.loginDescription")}
      </p>
      <AuthForm action={handleSubmit} defaultEmail={email} enhanced>
        <SubmitButton
          className="h-[50px] w-full gap-4 rounded-xl bg-[#202020] text-base font-semibold text-white shadow-sm hover:bg-[#333] focus-visible:ring-2 focus-visible:ring-[#176bff] focus-visible:ring-offset-2"
          isSuccessful={isSuccessful}
        >
          {t("auth.signIn")}
          <ArrowRight aria-hidden="true" className="size-[18px]" />
        </SubmitButton>
        <p className="text-center text-sm text-[#8490aa]">
          {t("auth.confirmNoAccount")}
          <Link
            className="ml-2 font-medium text-[#0668ff] underline-offset-4 hover:underline"
            href="/register"
          >
            {t("auth.signUp")}
          </Link>
        </p>
      </AuthForm>
    </>
  );
}
