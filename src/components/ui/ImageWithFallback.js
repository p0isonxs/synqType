import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useState } from "react";
export function ImageWithFallback({ src, alt, fallbackIcon, className = "" }) {
    const [hasError, setHasError] = useState(false);
    const handleError = useCallback(() => {
        setHasError(true);
    }, []);
    if (hasError) {
        return (_jsx("div", { className: "text-6xl", role: "img", "aria-label": alt, children: fallbackIcon }));
    }
    return (_jsx("img", { src: src, alt: alt, className: className, onError: handleError }));
}
