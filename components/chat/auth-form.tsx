"use client";

import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Form from "next/form";
import { useCallback, useState } from "react";
import { usePreferences } from "../preferences-provider";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function AuthForm({
  action,
  children,
  defaultEmail = "",
  enhanced = false,
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  enhanced?: boolean;
}) {
  const { t } = usePreferences();
  const [showPassword, setShowPassword] = useState(false);

  const togglePassword = useCallback(
    () => setShowPassword((visible) => !visible),
    []
  );

  return (
    <Form
      action={action}
      className={enhanced ? "mt-8 flex flex-col gap-6" : "flex flex-col gap-4"}
    >
      <div className="flex flex-col gap-2">
        <Label
          className={
            enhanced
              ? "text-base font-normal text-[#8490aa]"
              : "font-normal text-muted-foreground"
          }
          htmlFor="email"
        >
          {t("common.email")}
        </Label>
        <div className="relative">
          {enhanced ? (
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 z-10 size-[18px] -translate-y-1/2 text-[#8490aa]"
            />
          ) : null}
          <Input
            autoComplete="email"
            autoFocus
            className={
              enhanced
                ? "h-[50px] rounded-xl border-[#dbe1ec] bg-white pl-12 text-sm text-[#172033] shadow-none placeholder:text-[#9ca6bc] focus-visible:border-[#176bff] focus-visible:ring-[#176bff]/15"
                : "text-sm"
            }
            defaultValue={defaultEmail}
            id="email"
            name="email"
            placeholder={enhanced ? "you@company.com" : "you@someo.ne"}
            required
            type="email"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label
          className={
            enhanced
              ? "text-base font-normal text-[#8490aa]"
              : "font-normal text-muted-foreground"
          }
          htmlFor="password"
        >
          {t("auth.password")}
        </Label>
        <div className="relative">
          {enhanced ? (
            <LockKeyhole
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 z-10 size-[18px] -translate-y-1/2 text-[#8490aa]"
            />
          ) : null}
          <Input
            autoComplete={enhanced ? "current-password" : "new-password"}
            className={
              enhanced
                ? "h-[50px] rounded-xl border-[#dbe1ec] bg-white px-12 text-sm text-[#172033] shadow-none placeholder:text-[#9ca6bc] focus-visible:border-[#176bff] focus-visible:ring-[#176bff]/15"
                : "text-sm"
            }
            id="password"
            name="password"
            placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
            required
            type={showPassword ? "text" : "password"}
          />
          {enhanced ? (
            <button
              aria-label={t(
                showPassword ? "auth.hidePassword" : "auth.showPassword"
              )}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-[#8490aa] hover:text-[#176bff] focus-visible:outline-2 focus-visible:outline-[#176bff]"
              onClick={togglePassword}
              type="button"
            >
              {showPassword ? (
                <Eye aria-hidden="true" className="size-[18px]" />
              ) : (
                <EyeOff aria-hidden="true" className="size-[18px]" />
              )}
            </button>
          ) : null}
        </div>
      </div>

      {children}
    </Form>
  );
}
