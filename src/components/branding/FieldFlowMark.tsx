import { useTheme } from "@/hooks/useTheme";
import lightMark from "@/assets/fieldflow-icon.png";
import darkMark from "@/assets/fieldflow-icon-dark.png";
import wordmarkLight from "@/assets/fieldflow-logo.png";

interface FieldFlowMarkProps {
  variant?: "icon" | "wordmark";
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
}

/**
 * Theme-aware FieldFlow logo.
 * - "icon": swaps between gradient mark optimized for light vs dark backgrounds
 * - "wordmark": full lockup (currently single asset, falls back to wordmark)
 */
const FieldFlowMark = ({
  variant = "icon",
  className,
  width = 40,
  height = 40,
  alt = "FieldFlow",
}: FieldFlowMarkProps) => {
  const { theme } = useTheme();
  const src =
    variant === "wordmark"
      ? wordmarkLight
      : theme === "dark"
      ? darkMark
      : lightMark;

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      className={className}
    />
  );
};

export default FieldFlowMark;
