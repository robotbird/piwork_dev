"use client";

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
  const { translate } = usePreferences();
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
        description: translate("邮箱或密码错误！", "Invalid credentials!"),
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
        {translate("欢迎回来", "Welcome back")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {translate("登录账户以继续", "Sign in to your account to continue")}
      </p>
      <AuthForm action={handleSubmit} defaultEmail={email}>
        <SubmitButton isSuccessful={isSuccessful}>
          {translate("登录", "Sign in")}
        </SubmitButton>
        <p className="text-center text-sm text-muted-foreground">
          {translate("还没有账户？", "No account? ")}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href="/register"
          >
            {translate("注册", "Sign up")}
          </Link>
        </p>
      </AuthForm>
    </>
  );
}
