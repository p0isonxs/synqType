import React, { useState } from 'react';
import { useOptimizedBettingContract } from '../hooks/useBettingContract';
import toast from 'react-hot-toast';

interface BetConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  betAmount: string;
  hostName: string;
  onConfirmed: () => void;
  isOptimized?: boolean;
}

export default function OptimizedBetConfirmationModal({
  isOpen,
  onClose,
  roomId,
  betAmount,
  hostName,
  onConfirmed,
  isOptimized = false
}: BetConfirmationModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  
  const { joinRoom, isLoading: isBettingLoading } = useOptimizedBettingContract(roomId, true);

  const handleConfirmBet = async () => {
    if (!betAmount || isConfirming || isBettingLoading) return;

    try {
      setIsConfirming(true);
      toast.success('Joining betting pool...');
      await joinRoom(betAmount);
      toast.success('Successfully joined betting pool!');
      onConfirmed();
    } catch (error: any) {
      console.error('Bet confirmation error:', error);
      toast.error(error.message || 'Failed to join betting pool');
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 max-w-sm w-full border border-gray-700">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="font-p0">
            Join Betting Pool
          </h2>
          <p className="text-gray-400 text-sm">
            Hosted by <span className="text-white">{hostName}</span>
          </p>
        </div>

        {/* Bet Amount */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 text-center">
          <div className="text-gray-400 text-sm mb-1">Bet Amount</div>
          <div className="text-white font-bold text-2xl">{betAmount} MON</div>
          <div className="text-gray-400 text-xs mt-1">Room: {roomId}</div>
        </div>

        {/* Info */}
        <div className="mb-6 text-center">
          <p className="text-gray-300 text-sm">
            Join the betting pool to compete for prizes. Winner gets the total pot automatically.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            disabled={isConfirming || isBettingLoading}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={handleConfirmBet}
            disabled={isConfirming || isBettingLoading}
            className="flex-1 py-3 bg-white hover:bg-gray-100 text-black font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
          >
            {isConfirming || isBettingLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-gray-600 border-t-black rounded-full animate-spin"></div>
                <span>Joining...</span>
              </div>
            ) : (
              `Join (${betAmount} MON)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}