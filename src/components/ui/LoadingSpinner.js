import { jsx as _jsx } from "react/jsx-runtime";
export function LoadingSpinner({ size = 'md', className = '' }) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
    };
    return (_jsx("div", { className: `animate-spin rounded-full border-2 border-gray-300 border-t-gray-800 ${sizeClasses[size]} ${className}`, role: "status", "aria-label": "Loading", children: _jsx("span", { className: "sr-only", children: "Loading..." }) }));
}
