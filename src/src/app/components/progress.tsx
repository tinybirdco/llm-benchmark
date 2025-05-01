export const ProgressBar = ({ progress }: { progress: number }) => {
  const color =
    progress > 50
      ? "bg-[#27F795]"
      : "bg-[#FF6153]";

  return (
    <div className="w-16 bg-[#353535] h-2 mr-2">
      <div className={`${color} h-2`} style={{ width: `${progress}%` }} />
    </div>
  );
};
