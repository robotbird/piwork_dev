"use client";

import { useCallback, useState } from "react";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function useMemberPagination<T>(items: readonly T[], resetKey: string) {
  const [state, setState] = useState({ key: resetKey, page: 1, pageSize: 10 });
  const pages = Math.max(1, Math.ceil(items.length / state.pageSize));
  const page = Math.min(state.key === resetKey ? state.page : 1, pages);
  if (state.key !== resetKey || state.page !== page) {
    setState({ ...state, key: resetKey, page });
  }
  return {
    items: items.slice((page - 1) * state.pageSize, page * state.pageSize),
    onPageChange: (value: number) => setState({ ...state, page: value }),
    onPageSizeChange: (value: string) =>
      setState({ ...state, page: 1, pageSize: Number(value) }),
    page,
    pageSize: state.pageSize,
    pages,
    total: items.length,
  };
}

export function MemberPagination({
  page,
  pages,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pages: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (value: string) => void;
}) {
  const { t } = usePreferences();
  const previousPage = useCallback(
    () => onPageChange(page - 1),
    [onPageChange, page]
  );
  const nextPage = useCallback(
    () => onPageChange(page + 1),
    [onPageChange, page]
  );
  return (
    <nav
      aria-label={t("memberPagination.label")}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3"
    >
      <span aria-live="polite" className="text-sm text-muted-foreground">
        {t("memberPagination.total", { count: total })}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Select onValueChange={onPageSizeChange} value={String(pageSize)}>
          <SelectTrigger aria-label={t("memberPagination.pageSize")} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {[10, 20, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {t("memberPagination.perPage", { count: size })}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          disabled={page <= 1}
          onClick={previousPage}
          size="sm"
          variant="outline"
        >
          {t("memberPagination.previous")}
        </Button>
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {t("memberPagination.page", { page, pages })}
        </span>
        <Button
          disabled={page >= pages}
          onClick={nextPage}
          size="sm"
          variant="outline"
        >
          {t("memberPagination.next")}
        </Button>
      </div>
    </nav>
  );
}
