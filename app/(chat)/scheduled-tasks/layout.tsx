/** Scheduled Tasks 页面布局 - 不使用聊天界面壳 */

export default function ScheduledTasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* 简单的顶部栏 */}
      <header className="flex h-14 items-center border-b px-6">
        <h1 className="text-lg font-semibold">定时任务</h1>
      </header>
      {/* 主要内容区域 */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
