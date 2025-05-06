export const ProgressBar = ({ progress }: { progress: number }) => {
  const color =
    progress >= 90
      ? "bg-[#27F795]"
      : progress >= 80
        ? "bg-[#F7D727]"
        : "bg-[#F72727]";

  return (
    <div className="w-16 bg-[#353535] h-2 mr-2">
      <div className={`${color} h-2`} style={{ width: `${progress}%` }} />
    </div>
  );
};
