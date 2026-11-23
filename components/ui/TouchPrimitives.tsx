import { Link } from "@/i18n/navigation";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

export type TouchVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "whatsapp"
  | "danger";

const VARIANT_CLASSES: Record<TouchVariant, string> = {
  primary:
    "bg-brand-red text-ivory border border-brand-red shadow-sm hover:opacity-95",
  secondary:
    "bg-navy-900 text-ivory border border-navy-700 hover:border-silver/50",
  ghost:
    "bg-transparent text-silver border border-transparent hover:text-ivory",
  whatsapp:
    "bg-whatsapp-green text-white border border-whatsapp-green shadow-sm hover:opacity-95",
  danger:
    "bg-brand-red/15 text-ivory border border-brand-red/70 hover:bg-brand-red",
};

const BASE_INTERACTIVE =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TouchVariant;
}

export function Button({
  variant = "primary",
  type = "button",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE_INTERACTIVE} ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: TouchVariant;
  children: ReactNode;
}

export function IconButton({
  label,
  variant = "secondary",
  type = "button",
  className = "",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export interface ActionLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: TouchVariant;
  external?: boolean;
}

export function ActionLink({
  href,
  variant = "primary",
  external = false,
  className = "",
  children,
  ...props
}: ActionLinkProps) {
  const classes = `${BASE_INTERACTIVE} ${VARIANT_CLASSES[variant]} ${className}`;

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
