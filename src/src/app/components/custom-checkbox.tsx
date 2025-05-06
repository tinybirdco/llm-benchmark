import React from "react";

interface CustomCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ checked, onChange, className = "", ...props }) => (
    <span className={`custom-checkbox ${className}`}>
        <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            {...props}
        />
        <span className="custom-checkbox-box">
            <svg
                className="checkmark"
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
            >
                <path
                    d="M4 8.5L7 11.5L12 5.5"
                    stroke="#222"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </span>
    </span>
); 