export function useRouter() {
  return {
    push() {
      /* The isolated preview does not navigate. */
    },
    refresh() {
      /* Locale state is controlled by the preview. */
    },
    replace() {
      /* The isolated preview does not navigate. */
    },
  };
}
export function usePathname() {
  return "/";
}
export function useSearchParams() {
  return new URLSearchParams();
}
