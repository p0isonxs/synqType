import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useOptimizedBettingContract } from '../hooks/useBettingContract';
import toast from 'react-hot-toast';
export default function OptimizedBetConfirmationModal({ isOpen, onClose, roomId, betAmount, hostName, onConfirmed, isOptimized = false }) {
    const [isConfirming, setIsConfirming] = useState(false);
    const { joinRoom, isLoading: isBettingLoading } = useOptimizedBettingContract(roomId, true);
    const handleConfirmBet = async () => {
        if (!betAmount || isConfirming || isBettingLoading)
            return;
        try {
            setIsConfirming(true);
            await joinRoom(betAmount);
            onConfirmed();
        }
        catch (error) {
            console.error('Bet confirmation error:', error);
            toast.error(error.message || 'Failed to join betting pool');
        }
        finally {
            setIsConfirming(false);
        }
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-gray-900 rounded-xl p-6 max-w-sm w-full border border-gray-700", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx("h2", { className: "font-p0", children: "Join Betting Pool" }), _jsxs("p", { className: "text-gray-400 text-sm", children: ["Hosted by ", _jsx("span", { className: "text-white", children: hostName })] })] }), _jsxs("div", { className: "bg-gray-800 rounded-lg p-4 mb-6 text-center", children: [_jsx("div", { className: "text-gray-400 text-sm mb-1", children: "Bet Amount" }), _jsxs("div", { className: "text-white font-bold text-2xl", children: [betAmount, " MON"] }), _jsxs("div", { className: "text-gray-400 text-xs mt-1", children: ["Room: ", roomId] })] }), _jsx("div", { className: "mb-6 text-center", children: _jsx("p", { className: "text-gray-300 text-sm", children: "Join the betting pool to compete for prizes. Winner gets the total pot automatically." }) }), _jsxs("div", { className: "flex space-x-3", children: [_jsx("button", { onClick: onClose, disabled: isConfirming || isBettingLoading, className: "flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50", children: "Cancel" }), _jsx("button", { onClick: handleConfirmBet, disabled: isConfirming || isBettingLoading, className: "flex-1 py-3 bg-white hover:bg-gray-100 text-black font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none", children: isConfirming || isBettingLoading ? (_jsxs("div", { className: "flex items-center justify-center space-x-2", children: [_jsx("div", { className: "w-4 h-4 border-2 border-gray-600 border-t-black rounded-full animate-spin" }), _jsx("span", { children: "Joining..." })] })) : (`Join (${betAmount} MON)`) })] })] }) }));
}
