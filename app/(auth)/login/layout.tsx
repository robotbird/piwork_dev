import { AuthFrame } from "@/components/auth/auth-frame";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthFrame>{children}</AuthFrame>;
}
