import humanResults from "../../../benchmark/results-human.json";
import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { useParams, useRouter } from "next/navigation";
import { ChevronDownIcon } from "./icons";
import Link from "next/link";
import { ArrowRightIcon, GithubIcon, HelpCircleIcon } from "lucide-react";
import { Button } from "./button";

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
      <PopoverTrigger className="w-full">
        <button className="bg-[#353535] w-full font-sans text-sm text-left hover:bg-[#454545] p-4 hover:text-white w-full flex items-center justify-between">
          {selectedQuestionLabel || "All Questions"}

          <ChevronDownIcon />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-full block max-w-[1400px] bg-[#353535] font-sans text-sm max-h-[500px] overflow-y-auto border-none rounded-none p-0"
      >
        {questionOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleQuestionChange(opt.value)}
            className="block text-left hover:bg-[#454545] p-4 hover:text-white w-full"
          >
            {opt.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export const Header = () => {
  return (
    <header>
      <div className="space-y-5 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <h1 className="text-3xl">AI SQL Generation Benchmark Results</h1>

          <div className="flex gap-2 items-center">
            <Button variant="secondary" size="lg"><GithubIcon /> Code repo</Button>
            <Button variant="default" size="lg"><HelpCircleIcon /> How did we do this?</Button>
          </div>
        </div>

        <p className="text-sm max-w-[556px]">
          We uploaded to{" "}
          <Link
            className="text-[#27F795]"
            href="https://tinybird.co/"
            target="_blank"
          >
            Tinybird
          </Link>{" "}
          a 3.1 billion record dataset from the{" "}
          <Link
            className="text-[#27F795]"
            href="https://www.gharchive.org/"
            target="_blank"
          >
            GH Archive
          </Link>{" "}
          that contains all the events in all GitHub repositories since 2011 in
          structured format. We benchmarked several LLMs to generate SQL queries
          to answer{" "}
          <Link
            className="text-[#27F795]"
            href="https://ghe.clickhouse.tech/"
            target="_blank"
          >
            these questions
          </Link>{" "}
          about the data, and we have compared the results with a human
          baseline.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-4 max-w-[1400px]">
        <QuestionSelect />
      </div>
    </header>
  );
};
