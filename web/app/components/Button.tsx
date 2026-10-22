import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "md" | "lg";
export type ButtonTone = "default" | "inverse";

type SharedProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** "inverse" for use on the ink band (footer, dark map overlays). */
  tone?: ButtonTone;
  /** Trailing arrow. Defaults to true for primary, false for secondary. */
  arrow?: boolean;
  children: ReactNode;
  className?: string;
};

/*
 * Primary: a solid, square-cornered river-blue block. One per view.
 * Secondary: an underlined text action, the way a newspaper links out.
 * It still gets a full 48px tap height. Never two solid buttons side by side.
 */
const BASE =
  "group inline-flex shrink-0 items-center font-sans font-semibold whitespace-nowrap transition-colors duration-(--duration-fast) ease-editorial focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const SIZE: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: {
    md: "h-12 gap-3 px-5 text-small",
    lg: "h-14 gap-3 px-6 text-body",
  },
  secondary: {
    md: "h-12 gap-2 text-small",
    lg: "h-14 gap-2 text-body",
  },
};

const LOOK: Record<ButtonVariant, Record<ButtonTone, string>> = {
  primary: {
    default:
      "rounded-xs bg-river text-paper hover:bg-river-deep focus-visible:outline-river",
    inverse:
      "rounded-xs bg-paper text-ink hover:bg-surface focus-visible:outline-paper",
  },
  secondary: {
    default:
      "text-ink hover:text-river focus-visible:outline-river",
    inverse:
      "text-paper hover:text-river-light focus-visible:outline-paper",
  },
};

function classesFor(
  variant: ButtonVariant,
  size: ButtonSize,
  tone: ButtonTone,
  extra: string,
) {
  return `${BASE} ${SIZE[variant][size]} ${LOOK[variant][tone]} ${extra}`;
}

function Content({
  variant,
  arrow,
  children,
}: {
  variant: ButtonVariant;
  arrow: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <span
        className={
          variant === "secondary"
            ? "r200-label border-b-[1.5px] pb-0.5 leading-tight"
            : "r200-label"
        }
      >
        {children}
      </span>
      {arrow && (
        <span
          aria-hidden="true"
          className="transition-transform duration-(--duration-fast) ease-editorial group-hover:translate-x-0.5"
        >
          →
        </span>
      )}
    </>
  );
}

type ButtonLinkProps = SharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "className"> & {
    href: string;
  };

/** A link styled as a button. Internal paths and #anchors use next/link. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  tone = "default",
  arrow,
  children,
  className = "",
  href,
  ...anchorProps
}: ButtonLinkProps) {
  const showArrow = arrow ?? variant === "primary";
  return (
    <Link
      href={href}
      className={classesFor(variant, size, tone, className)}
      {...anchorProps}
    >
      <Content variant={variant} arrow={showArrow}>
        {children}
      </Content>
    </Link>
  );
}

type ButtonProps = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className">;

/** A real <button>, for form submits and in-page actions. */
export function Button({
  variant = "primary",
  size = "md",
  tone = "default",
  arrow,
  children,
  className = "",
  type = "button",
  ...buttonProps
}: ButtonProps) {
  const showArrow = arrow ?? variant === "primary";
  return (
    <button
      type={type}
      className={classesFor(variant, size, tone, className)}
      {...buttonProps}
    >
      <Content variant={variant} arrow={showArrow}>
        {children}
      </Content>
    </button>
  );
}
