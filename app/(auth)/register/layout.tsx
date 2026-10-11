import { AuthFrame } from "@/components/auth/auth-frame";

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthFrame>{children}</AuthFrame>;
}
