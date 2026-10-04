import type { SVGProps } from "react";

/** Pi's three-color mark, traced from the supplied brand reference. */
export function PiLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 120 120" {...props}>
      <path d="M0 0h90v60H60V30H0Z" fill="#F38C7E" />
      <path d="M0 30h30v30h30v30H30v30H0Z" fill="#4C9FBC" />
      <path d="M90 60h30v60H90Z" fill="#F4BE55" />
    </svg>
  );
}
