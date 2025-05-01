const classNames = (status: string) => {
  switch (status) {
    case "success":
      return "bg-[#00D570]/40 border-[#00D570]";
    case "warning":
      return "bg-[#FFE600]/40 border-[#FFE600]";
    case "error":
      return "bg-[#FF0000]/40 border-[#FF0000]";
    case "build":
      return "bg-[#2D27F7]/40 border-[#2D27F7]";
    default:
      return "bg-white/10 border-white";
  }
}

export const Badge = ({
  children,
  status,
}: {
  children: React.ReactNode;
  status: "info" | "success" | "warning" | "error" | "build";
}) => {
  return (
    <span className={`${classNames(status)} inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border text-white font-mono uppercase font-medium`}>
      {children}
    </span>
  );
};
