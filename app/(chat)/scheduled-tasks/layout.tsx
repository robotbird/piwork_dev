export default function ScheduledTasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="h-dvh overflow-y-auto bg-background">{children}</main>
  );
}
