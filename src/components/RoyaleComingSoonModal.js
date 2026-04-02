import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/components/RoyaleComingSoonModal.tsx
import { useSound } from "../contexts/UserContext";
export default function RoyaleComingSoonModal({ onClose }) {
    const { playClickSound } = useSound();
    const handleClose = () => {
        playClickSound();
        onClose();
    };
    return (_jsxs("div", { className: "fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-20", children: [_jsxs("div", { className: "bg-[#0f0f0f] border-[#826df9] border-2 rounded-xl p-8 text-center max-w-md w-full relative shadow-2xl", children: [_jsx("h2", { className: "text-3xl font-bold mb-4 text-[#826df9]", children: "Coming Soon" }), _jsxs("p", { className: "text-gray-300 mb-6", children: [_jsx("span", { className: "text-[#826df9] font-semibold", children: "Royale Mode" }), " is under development.", _jsx("br", {}), "The battle for the blockchain keyboard is near."] }), _jsx("button", { className: "bg-[#826df9] text-black px-5 py-2 rounded hover:opacity-90 transform hover:scale-105 transition", onClick: handleClose, children: "Back" })] }), _jsx("div", { className: "absolute inset-0 pointer-events-none", children: [...Array(10)].map((_, i) => (_jsx("div", { className: `particle particle-${i + 1}` }, i))) })] }));
}
