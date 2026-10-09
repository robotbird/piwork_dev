"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * 用户头像：有 User.image（受保护 LibraryItem 预览地址）用图片，否则显示
 * 姓名首字母。与侧边栏 user-nav 的头像同一渲染口径。
 */
export function UserAvatar({
  className,
  image,
  name,
  size = 24,
}: {
  className?: string;
  image?: string | null;
  name?: string | null;
  size?: number;
}) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <span
      className={cn(
        "relative flex shrink-0 select-none overflow-hidden rounded-full bg-primary/12",
        className
      )}
      style={{ height: size, width: size }}
    >
      {image ? (
        <Image
          alt={name ?? ""}
          className="size-full object-cover"
          height={size}
          src={image}
          unoptimized
          width={size}
        />
      ) : (
        <span
          className="flex size-full items-center justify-center font-medium text-primary"
          style={{ fontSize: Math.max(10, size * 0.42) }}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
