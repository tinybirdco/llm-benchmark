import { cn } from "@/lib/utils";

export const ArrowLeftIcon = () => {
  return (
    <svg
      width="13"
      height="8"
      viewBox="0 0 13 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.29971 0.240672C4.5594 -0.0190262 4.98046 -0.0190263 5.24016 0.240672C5.49986 0.500371 5.49986 0.921426 5.24016 1.18112L3.09084 3.33044L12.3349 3.33044C12.7022 3.33044 12.9999 3.62817 12.9999 3.99544C12.9999 4.36271 12.7022 4.66044 12.3349 4.66044L3.05553 4.66044L5.24015 6.84506C5.49985 7.10476 5.49985 7.52581 5.24015 7.78551C4.98045 8.04521 4.5594 8.04521 4.2997 7.78551L0.997508 4.48332C0.73781 4.22362 0.73781 3.80257 0.997508 3.54287L4.29971 0.240672Z"
        fill="currentColor"
      />
    </svg>
  );
};

export const ChevronDownIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={cn("w-4 h-4", className)}
      fill="currentColor"
      {...props}
    >
      <path d="M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z"></path>
    </svg>
  );
};
