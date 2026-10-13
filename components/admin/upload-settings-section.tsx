"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchUploadSettings,
  UPLOAD_SETTINGS_URL,
} from "@/hooks/use-upload-settings";
import {
  type UploadSettings,
  uploadSettingsSchema,
} from "@/lib/uploads/settings";

const ADMIN_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/admin/upload-settings`;
export function UploadSettingsSection() {
  const t = useTranslations("settings.uploads");
  const { data, error, mutate, isLoading } = useSWR(
    ADMIN_URL,
    fetchUploadSettings
  );
  const { mutate: mutateGlobal } = useSWRConfig();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const value = draft ?? (data ? String(data.maxFileSizeMB) : "");
  const parsed = uploadSettingsSchema.safeParse({
    maxFileSizeMB: Number(value),
  });
  const invalid = draft !== null && !parsed.success;
  const dirty = data && Number(value) !== data.maxFileSizeMB;
  const change = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
    setSaveError(false);
  }, []);
  const retry = useCallback(() => {
    mutate();
  }, [mutate]);
  const save = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy || !parsed.success || !dirty) {
        return;
      }
      setBusy(true);
      setSaveError(false);
      try {
        const response = await fetch(ADMIN_URL, {
          body: JSON.stringify(parsed.data),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!response.ok) {
          throw new Error("upload-settings:save-failed");
        }
        const settings: UploadSettings = uploadSettingsSchema.parse(
          await response.json()
        );
        await mutate(settings, false);
        await mutateGlobal(UPLOAD_SETTINGS_URL, settings, false);
        setDraft(null);
        toast.success(t("saved"));
      } catch {
        setSaveError(true);
      } finally {
        setBusy(false);
      }
    },
    [busy, dirty, mutate, mutateGlobal, parsed, t]
  );
  return (
    <section className="mt-8">
      <h2 className="text-base font-medium leading-6">{t("title")}</h2>
      <form className="mt-4" onSubmit={save}>
        <Card className="rounded-[14px] shadow-none">
          <CardContent className="px-4 py-3">
            <FieldGroup>
              {isLoading ? <Skeleton className="h-12 w-full" /> : null}
              {error && !data ? (
                <div
                  className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
                  role="alert"
                >
                  <p className="text-sm text-destructive">{t("loadFailed")}</p>
                  <Button
                    onClick={retry}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t("retry")}
                  </Button>
                </div>
              ) : null}
              {data ? (
                <Field
                  className="min-h-10 flex-col sm:flex-row sm:items-center"
                  data-disabled={busy}
                  data-invalid={invalid}
                  orientation="horizontal"
                >
                  <FieldContent>
                    <FieldLabel
                      className="text-sm font-medium leading-5"
                      htmlFor="upload-max-file-size"
                    >
                      {t("label")}
                    </FieldLabel>
                  </FieldContent>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0">
                    <div className="flex items-center gap-2">
                      <InputGroup className="h-11 flex-1 sm:h-9 sm:w-[140px] sm:flex-none">
                        <InputGroupInput
                          aria-describedby={`upload-max-file-size-range${invalid ? " upload-max-file-size-error" : ""}`}
                          aria-invalid={invalid}
                          disabled={busy}
                          id="upload-max-file-size"
                          inputMode="numeric"
                          max={100}
                          min={1}
                          onChange={change}
                          required
                          step={1}
                          type="number"
                          value={value}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>{t("unit")}</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      <Button
                        className="h-11 rounded-full sm:h-9"
                        disabled={!dirty || invalid || busy}
                        size="sm"
                        type="submit"
                      >
                        {busy ? t("saving") : t("save")}
                      </Button>
                    </div>
                    <FieldDescription
                      className="sr-only"
                      id="upload-max-file-size-range"
                    >
                      {t("range")}
                    </FieldDescription>
                    {invalid ? (
                      <FieldError id="upload-max-file-size-error">
                        {t("invalid")}
                      </FieldError>
                    ) : null}
                  </div>
                </Field>
              ) : null}
              {saveError ? (
                <p className="text-sm text-destructive" role="alert">
                  {t("saveFailed")}
                </p>
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>
      </form>
    </section>
  );
}
