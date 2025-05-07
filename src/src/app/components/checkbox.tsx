import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, checked, onCheckedChange, ...props }, ref) => {
        return (
            <input
                type="checkbox"
                className={cn(
                    "h-4 w-4 rounded border-[#353535] bg-[#1A1A1A] text-[#27F795] focus:ring-[#27F795]",
                    className
                )}
                checked={checked}
                onChange={(e) => onCheckedChange?.(e.target.checked)}
                ref={ref}
                {...props}
            />
        );
    }
); 