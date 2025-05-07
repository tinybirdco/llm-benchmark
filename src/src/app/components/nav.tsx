import humanResults from "../../../benchmark/results-human.json";
import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { useParams, useRouter } from "next/navigation";
import { ChevronDownIcon } from "./icons";
import Link from "next/link";
import { GithubIcon, ClipboardListIcon } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { Filters } from "./filters";
import { ModelMetrics } from "@/lib/eval";
import { CustomCheckbox } from "./custom-checkbox";

type HeaderProps = {
  data: ModelMetrics[];
  selectedModels: string[];
  selectedProviders: string[];
  onModelChange: (models: string[]) => void;
  onProviderChange: (providers: string[]) => void;
  showRelative: boolean;
  onShowRelativeChange: (checked: boolean) => void;
};

export const QuestionSelect = () => {
  const router = useRouter();
  const { pipename } = useParams();

  // Build question options from humanResults
  const questionOptions = useMemo(() => {
    const seen = new Set();
    const opts = humanResults
      .map((r) => {
        if (!r.name || !r.question?.content) return null;
        if (seen.has(r.name)) return null;
        seen.add(r.name);
        return { value: r.name, label: r.question.content.split("\n")[0] };
      })
      .filter((opt): opt is { value: string; label: string } => Boolean(opt));
    return [{ value: "", label: "All Questions" }, ...opts];
  }, []);

  const selectedQuestionLabel = useMemo(() => {
    return (
      questionOptions.find((opt) => opt.value === pipename)?.label ||
      "All Questions"
    );
  }, [pipename, questionOptions]);

  // Handle select change: redirect if not All
  const handleQuestionChange = (value: string) => {
    if (value) {
      router.push(`/questions/${encodeURIComponent(value)}`);
    } else {
      router.push("/");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "bg-[#353535] lg:w-[415px] w-full sm:w-full font-sans text-sm text-left border-1 border-transparent hover:border-white data-[state=open]:border-white !outline-none p-4 hover:text-white flex items-center justify-between cursor-pointer"
          )}
        >
          <span className="truncate">
            {selectedQuestionLabel || "All Questions"}
          </span>
          <ChevronDownIcon className="flex-shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className={cn(
          "w-full max-w-[415px] bg-[#353535] font-sans text-sm max-h-[500px] overflow-y-auto border-none rounded-none p-0",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        )}
        style={{
          position: "relative",
          width: "100%",
          marginTop: "0",
          marginLeft: "0",
          transform: "none",
        }}
      >
        {questionOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleQuestionChange(opt.value)}
            className={cn(
              "block text-left hover:bg-[#454545] p-4 hover:text-white w-full cursor-pointer"
            )}
          >
            <span className="whitespace-normal break-words">{opt.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export const Header = ({
  data,
  selectedModels,
  selectedProviders,
  onModelChange,
  onProviderChange,
  showRelative,
  onShowRelativeChange,
}: HeaderProps) => {
  return (
    <header>
      <div className="space-y-5 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <h1 className="text-3xl">AI SQL Generation Benchmark Results</h1>

          <div className="flex gap-2 items-center">
            <Button variant="secondary" size="lg" className="cursor-pointer">
              GitHub <GithubIcon />
            </Button>
            <Button variant="default" size="lg" className="cursor-pointer">
              Methodology <ClipboardListIcon />
            </Button>
          </div>
        </div>

        <p className="text-sm max-w-[556px]">
          We assessed the ability of popular LLMs to generate accurate and
          efficient SQL from natural language prompts. Using a 200 million
          record dataset from the{" "}
          <Link
            className="text-accent hover:text-hover-accent"
            href="https://www.gharchive.org/"
            target="_blank"
          >
            GH Archive
          </Link>{" "}
          uploaded to{" "}
          <Link
            className="text-accent hover:text-hover-accent"
            href="https://tinybird.co/"
            target="_blank"
          >
            Tinybird
          </Link>
          , we asked the LLMs to generate SQL based on{" "}
          <Link
            className="text-[#27F795]"
            href="https://ghe.clickhouse.tech/"
            target="_blank"
          >
            50 prompts
          </Link>
          . The results are shown below and can be compared to a human baseline.
        </p>
      </div>

      <div className="mb-6 flex flex-col lg:flex-row items-stretch lg:items-center gap-4 max-w-[1400px]">
        <QuestionSelect />
        <Filters
          data={data}
          selectedProviders={selectedProviders}
          selectedModels={selectedModels}
          onProviderChange={onProviderChange}
          onModelChange={onModelChange}
        />
        <div className="flex items-center h-full">
          <label className="inline-flex items-center cursor-pointer">
            <CustomCheckbox
              checked={showRelative}
              onChange={(e) => onShowRelativeChange(e.target.checked)}
            />
            <span className="ml-2 text-sm text-[#F4F4F4]">
              Show metrics relative to human baseline
            </span>
          </label>
        </div>
      </div>
    </header>
  );
};
