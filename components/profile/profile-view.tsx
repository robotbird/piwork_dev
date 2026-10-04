"use client";

import {
  Building2,
  CalendarDays,
  Mail,
  Pencil,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { saveProfile } from "@/app/(account)/settings/actions";
import { usePreferences } from "@/components/preferences-provider";
import { UsageView } from "@/components/profile/usage-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { getProfile } from "@/lib/db/profile-queries";

export function ProfileView({
  profile,
  section,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof getProfile>>>;
  section: "profile" | "security" | "usage";
}) {
  const { t } = usePreferences();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState(profile.account.image);
  const [avatarPending, setAvatarPending] = useState(false);
  const tab = section;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(
    profile.account.name || profile.account.email.split("@")[0]
  );
  const [displayName, setDisplayName] = useState(name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (tab === "security" && newPassword !== confirmation) {
        setNotice(t("profile.mismatch"));
        return;
      }
      setPending(true);
      setNotice("");
      try {
        const result = await saveProfile(
          tab === "security" ? { currentPassword, newPassword } : { name }
        );
        if (result.error) {
          setNotice(t(`profile.${result.error}`));
          return;
        }
        setNotice(t("profile.saved"));
        if (tab === "security") {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmation("");
        } else {
          setDisplayName(name.trim());
          setEditing(false);
        }
      } catch {
        setNotice(t("profile.failed"));
      } finally {
        setPending(false);
      }
    },
    [tab, newPassword, confirmation, currentPassword, name, t]
  );
  const toggleEditing = useCallback(() => {
    setEditing((value) => !value);
    setName(displayName);
    setNotice("");
  }, [displayName]);
  const changeName = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    []
  );
  const changePassword = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const setters: Record<string, (value: string) => void> = {
        confirm: setConfirmation,
        current: setCurrentPassword,
        new: setNewPassword,
      };
      setters[event.target.id]?.(event.target.value);
    },
    []
  );
  const updateAvatar = useCallback(
    async (form: FormData) => {
      setAvatarPending(true);
      setNotice("");
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/profile/avatar`,
          { body: form, method: "POST" }
        );
        const result = (await response.json()) as {
          error?: string;
          image?: string | null;
        };
        if (!response.ok && !result.error) {
          throw new Error("Avatar upload failed");
        }
        if (result.error) {
          setNotice(t(`profile.${result.error}`));
        } else {
          setImage(result.image ?? null);
          router.refresh();
          setNotice(t("profile.saved"));
        }
      } catch {
        setNotice(t("profile.failed"));
      } finally {
        setAvatarPending(false);
      }
    },
    [t, router]
  );
  const chooseAvatar = useCallback(() => fileInput.current?.click(), []);
  const changeAvatar = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      if (
        file.size > 2 * 1024 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      ) {
        setNotice(t("profile.invalidAvatar"));
        return;
      }
      const form = new FormData();
      form.set("file", file);
      updateAvatar(form);
    },
    [t, updateAvatar]
  );
  const removeAvatar = useCallback(() => {
    const form = new FormData();
    form.set("remove", "true");
    updateAvatar(form);
  }, [updateAvatar]);
  if (section === "usage") {
    return <UsageView profile={profile} />;
  }
  return (
    <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
      <div className="mx-auto w-full max-w-[960px]">
        <h1 className="text-2xl font-semibold">
          {t(
            `profile.${section === "profile" ? "title" : section === "security" ? "password" : "usage"}`
          )}
        </h1>
        {tab !== "security" && (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 grid size-20 overflow-hidden rounded-full bg-primary/10 place-items-center text-3xl text-primary">
              {image ? (
                <Image
                  alt={t("profile.avatar")}
                  className="size-20 object-cover"
                  height={80}
                  src={image}
                  unoptimized
                  width={80}
                />
              ) : (
                displayName[0]?.toUpperCase()
              )}
            </div>
            {tab === "profile" && (
              <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                <input
                  accept="image/png,image/jpeg,image/webp"
                  aria-label={t("profile.uploadAvatar")}
                  className="sr-only"
                  disabled={avatarPending}
                  onChange={changeAvatar}
                  ref={fileInput}
                  type="file"
                />
                <Button
                  disabled={avatarPending}
                  onClick={chooseAvatar}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t(
                    avatarPending
                      ? "profile.uploadingAvatar"
                      : "profile.uploadAvatar"
                  )}
                </Button>
                {!!image && (
                  <Button
                    disabled={avatarPending}
                    onClick={removeAvatar}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {t("profile.resetAvatar")}
                  </Button>
                )}
              </div>
            )}
            <h2 className="break-words text-xl font-semibold">{displayName}</h2>
            <p className="mt-2 break-all text-sm text-muted-foreground">
              {profile.account.email}
            </p>
          </div>
        )}
        {!!notice && (
          <p className="mb-4 rounded-lg bg-accent p-3 text-sm" role="status">
            {notice}
          </p>
        )}
        {tab === "security" ? (
          <form
            className="mt-8 w-full space-y-5 rounded-xl border p-6"
            onSubmit={submit}
          >
            <p className="text-sm text-muted-foreground">
              {t("profile.passwordHint")}
            </p>
            {[
              {
                auto: "current-password",
                id: "current",
                label: "currentPassword",
                setter: setCurrentPassword,
                value: currentPassword,
              },
              {
                auto: "new-password",
                id: "new",
                label: "newPassword",
                setter: setNewPassword,
                value: newPassword,
              },
              {
                auto: "new-password",
                id: "confirm",
                label: "confirmPassword",
                setter: setConfirmation,
                value: confirmation,
              },
            ].map((f) => (
              <div key={f.id}>
                <label className="mb-2 block text-sm" htmlFor={f.id}>
                  {t(`profile.${f.label}`)}
                </label>
                <Input
                  autoComplete={f.auto}
                  id={f.id}
                  onChange={changePassword}
                  required
                  type="password"
                  value={f.value}
                />
              </div>
            ))}
            <Button disabled={pending}>
              {t(pending ? "profile.saving" : "profile.save")}
            </Button>
          </form>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-6">
            {tab === "profile" && (
              <section className="rounded-xl border p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="font-semibold">{t("profile.account")}</h2>
                  <Button onClick={toggleEditing} size="sm" variant="outline">
                    <Pencil className="mr-2 size-3" />
                    {t(editing ? "profile.cancel" : "profile.edit")}
                  </Button>
                </div>
                {editing ? (
                  <form className="space-y-4" onSubmit={submit}>
                    <label className="text-sm" htmlFor="name">
                      {t("profile.name")}
                    </label>
                    <Input
                      id="name"
                      maxLength={64}
                      onChange={changeName}
                      required
                      value={name}
                    />
                    <Button disabled={pending}>
                      {t(pending ? "profile.saving" : "profile.save")}
                    </Button>
                  </form>
                ) : (
                  <dl>
                    {[
                      { icon: UserRound, label: "name", value: displayName },
                      {
                        icon: Mail,
                        label: "email",
                        value: profile.account.email,
                      },
                      {
                        icon: ShieldCheck,
                        label: "role",
                        value: profile.account.roles.length
                          ? profile.account.roles.join("、")
                          : profile.account.role
                            ? t(`profile.roles.${profile.account.role}`)
                            : t("profile.unassigned"),
                      },
                      {
                        icon: Building2,
                        label: "department",
                        value:
                          profile.account.department || t("profile.unassigned"),
                      },
                      {
                        icon: CalendarDays,
                        label: "joined",
                        value: profile.account.createdAt,
                      },
                    ].map(({ icon: Icon, label, value }) => (
                      <div
                        className="flex items-center gap-4 border-b py-5 last:border-0"
                        key={label}
                      >
                        <Icon className="size-5 shrink-0" />
                        <dt className="w-20 shrink-0 text-sm text-muted-foreground">
                          {t(`profile.${label}`)}
                        </dt>
                        <dd className="break-all text-sm">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
