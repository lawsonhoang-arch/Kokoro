import type { ButtonHTMLAttributes, ReactNode } from "react";

// ---- Button (.btn / .btn--primary / .btn--ghost) ---------------------------
type ButtonVariant = "default" | "primary" | "ghost";
type ButtonProps = {
  variant?: ButtonVariant;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "default",
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const v =
    variant === "primary"
      ? " btn--primary"
      : variant === "ghost"
        ? " btn--ghost"
        : "";
  return (
    <button type={type} className={"btn" + v + (className ? " " + className : "")} {...rest}>
      {children}
    </button>
  );
}

// ---- Chip (.chip / .chip--accent) ------------------------------------------
type ChipProps = {
  accent?: boolean;
  children: ReactNode;
  className?: string;
};

export function Chip({ accent, children, className }: ChipProps) {
  return (
    <span
      className={"chip" + (accent ? " chip--accent" : "") + (className ? " " + className : "")}
    >
      {children}
    </span>
  );
}

// ---- Card (.card / .card--pad) ---------------------------------------------
type CardProps = {
  pad?: boolean;
  as?: "div" | "article" | "section";
  children: ReactNode;
  className?: string;
};

export function Card({ pad, as: Tag = "div", children, className }: CardProps) {
  return (
    <Tag className={"card" + (pad ? " card--pad" : "") + (className ? " " + className : "")}>
      {children}
    </Tag>
  );
}

// ---- Avatar (.avatar / --lg / --xl / --hN) ---------------------------------
type AvatarProps = {
  hue?: number; // 1–6
  size?: "default" | "lg" | "xl";
  className?: string;
  style?: React.CSSProperties;
  src?: string | null; // character art (or null → the hue circle)
};

export function Avatar({ hue, size = "default", className, style, src }: AvatarProps) {
  const s = size === "lg" ? " avatar--lg" : size === "xl" ? " avatar--xl" : "";
  return (
    <span
      className={"avatar" + s + (hue ? ` avatar--h${hue}` : "") + (src ? " avatar--img" : "") + (className ? " " + className : "")}
      style={style}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="avatar__img" src={src} alt="" referrerPolicy="no-referrer" />
      ) : null}
    </span>
  );
}

// ---- Stars (.stars + .stars__count) ----------------------------------------
export function Stars({ value, count }: { value?: number; count?: ReactNode }) {
  const full = Math.round(value ?? 5);
  return (
    <span className="stars">
      {"★★★★★".slice(0, full)}
      {count != null ? <span className="stars__count">{count}</span> : null}
    </span>
  );
}
