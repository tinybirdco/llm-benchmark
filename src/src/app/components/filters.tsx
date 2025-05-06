import { cn } from "@/lib/utils";
import { ModelMetrics } from "@/lib/eval";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { ChevronDownIcon } from "./icons";
import { CustomCheckbox } from "./custom-checkbox";
import { useMemo } from "react";

type FilterProps = {
    label: string;
    options: string[];
    selected: string[];
    onChange: (value: string[]) => void;
};

export function Filter({ label, options, selected, onChange }: FilterProps) {
    const selectedLabel = selected.length === 0
        ? `All ${label}`
        : selected.length === 1
            ? selected[0]
            : `${selected.length} ${label} selected`;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className={cn(
                    "bg-[#353535] w-full sm:w-[200px] font-sans text-sm text-left hover:bg-[#454545] p-4 hover:text-white flex items-center justify-between cursor-pointer"
                )}>
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronDownIcon className="flex-shrink-0 ml-2" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                side="bottom"
                sideOffset={0}
                className={cn(
                    "max-w-[415px] bg-[#353535] font-sans text-sm max-h-[500px] overflow-y-auto border-none rounded-none p-0",
                    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                )}

            >
                {options.map((option) => (
                    <button
                        key={option}
                        onClick={() => {
                            if (selected.includes(option)) {
                                onChange(selected.filter(s => s !== option));
                            } else {
                                onChange([...selected, option]);
                            }
                        }}
                        className={cn(
                            "block text-left hover:bg-[#454545] p-4 hover:text-white w-full cursor-pointer flex items-center gap-2",
                            selected.includes(option) && "bg-[#454545]"
                        )}
                    >
                        <CustomCheckbox
                            checked={selected.includes(option)}
                            onChange={() => {
                                if (selected.includes(option)) {
                                    onChange(selected.filter(s => s !== option));
                                } else {
                                    onChange([...selected, option]);
                                }
                            }}
                            className="border-[#FFFFFF] data-[state=checked]:bg-[#27F795] data-[state=checked]:border-[#27F795] data-[state=checked]:text-[#222]"
                        />
                        <span className="whitespace-normal break-words">{option}</span>
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
}

type FiltersProps = {
    data: ModelMetrics[];
    selectedModels: string[];
    selectedProviders: string[];
    onModelChange: (models: string[]) => void;
    onProviderChange: (providers: string[]) => void;
};

export function Filters({
    data,
    selectedModels,
    selectedProviders,
    onModelChange,
    onProviderChange,
}: FiltersProps) {
    // Cross-filtering logic
    const filteredModels = useMemo(() => {
        if (selectedProviders.length === 0) {
            return Array.from(new Set(data.map((d) => d.model))).sort();
        }
        return Array.from(new Set(
            data.filter((d) => selectedProviders.includes(d.provider)).map((d) => d.model)
        )).sort();
    }, [data, selectedProviders]);

    const filteredProviders = useMemo(() => {
        if (selectedModels.length === 0) {
            return Array.from(new Set(data.map((d) => d.provider))).sort();
        }
        return Array.from(new Set(
            data.filter((d) => selectedModels.includes(d.model)).map((d) => d.provider)
        )).sort();
    }, [data, selectedModels]);

    return (
        <div className="flex flex-col sm:flex-row gap-4">
            <Filter
                label="Providers"
                options={filteredProviders}
                selected={selectedProviders}
                onChange={onProviderChange}
            />
            <Filter
                label="Models"
                options={filteredModels}
                selected={selectedModels}
                onChange={onModelChange}
            />
        </div>
    );
} 