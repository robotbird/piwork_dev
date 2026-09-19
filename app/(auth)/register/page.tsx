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
  const { translate } = usePreferences();
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
        description: translate("账户已存在！", "Account already exists!"),
        type: "error",
      });
    } else if (state.status === "failed") {
      toast({
        description: translate("账户创建失败！", "Failed to create account!"),
        type: "error",
      });
    } else if (state.status === "invalid_data") {
      toast({
        description: translate(
          "提交内容校验失败！",
          "Failed validating your submission!"
        ),
        type: "error",
      });
    } else if (state.status === "success") {
      toast({
        description: translate("账户已创建！", "Account created!"),
        type: "success",
      });
      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
  }, [state.status, translate]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <>
      <h1 className="text-heading-lg">
        {translate("创建账户", "Create account")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {translate("免费开始使用", "Get started for free")}
      </p>
      <AuthForm action={handleSubmit} defaultEmail={email}>
        <SubmitButton isSuccessful={isSuccessful}>
          {translate("注册", "Sign up")}
        </SubmitButton>
        <p className="text-center text-sm text-muted-foreground">
          {translate("已有账户？", "Have an account? ")}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href="/login"
          >
            {translate("登录", "Sign in")}
          </Link>
        </p>
      </AuthForm>
    </>
  );
}
