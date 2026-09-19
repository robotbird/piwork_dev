import Form from "next/form";
import { usePreferences } from "../preferences-provider";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function AuthForm({
  action,
  children,
  defaultEmail = "",
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
}) {
  const { translate } = usePreferences();

  return (
    <Form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label className="font-normal text-muted-foreground" htmlFor="email">
          {translate("邮箱", "Email")}
        </Label>
        <Input
          autoComplete="email"
          autoFocus
          className="text-sm"
          defaultValue={defaultEmail}
          id="email"
          name="email"
          placeholder="you@someo.ne"
          required
          type="email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="font-normal text-muted-foreground" htmlFor="password">
          {translate("密码", "Password")}
        </Label>
        <Input
          className="text-sm"
          id="password"
          name="password"
          placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
          required
          type="password"
        />
      </div>

      {children}
    </Form>
  );
}
