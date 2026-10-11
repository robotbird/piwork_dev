import type { ComponentProps } from "react";
export default function Image({
  unoptimized: _unoptimized,
  ...props
}: ComponentProps<"img"> & { unoptimized?: boolean }) {
  // Test-only replacement for Next's bundler-specific image component; protected URLs remain unchanged.
  // biome-ignore lint/performance/noImgElement: Isolated test fixture cannot use Next bundler-specific Image.
  return <img alt={props.alt ?? ""} {...props} />;
}
