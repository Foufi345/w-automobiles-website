import type { SVGProps } from "react";

/**
 * Universal official WhatsApp brand icon.
 * Features a solid speech bubble with the phone handset carved out (evenodd),
 * ensuring crisp, branded rendering across green, dark, or light backgrounds.
 */
export function WhatsAppIcon({
  className = "h-5 w-5 fill-current",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zM17.472 14.382c-.301-.15-1.78-.878-2.056-.98-.276-.102-.477-.15-.678.15-.2.301-.777.98-.953 1.18-.176.2-.352.226-.653.076-.301-.15-1.272-.469-2.423-1.496-.896-.799-1.5-1.787-1.677-2.088-.176-.301-.019-.464.132-.614.136-.135.301-.352.451-.527.15-.176.2-.301.301-.502.101-.2.05-.377-.025-.527-.075-.15-.678-1.633-.929-2.235-.245-.586-.494-.506-.678-.515-.176-.008-.377-.01-.578-.01-.2 0-.527.075-.803.376s-1.054 1.03-1.054 2.51c0 1.48 1.079 2.909 1.23 3.11.15.2 2.123 3.243 5.143 4.542.718.309 1.279.494 1.716.633.722.23 1.38.197 1.9-.12.58-.354 1.78-1.028 2.03-1.727.25-.699.25-1.298.175-1.423-.075-.125-.276-.2-.577-.35z"
      />
    </svg>
  );
}
