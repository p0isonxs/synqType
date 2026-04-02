// ✅ NEW FILE - src/hooks/useDeployBettingContract.ts
// Following Bombandak pattern - simple and effective
import { useState } from 'react';
import { BETTING_CONTRACT_ADDRESS } from '../config/bettingContract';
export function useDeployBettingContract() {
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployedAddress, setDeployedAddress] = useState();
    const deployContract = async (betAmountInEther) => {
        setIsDeploying(true);
        try {
            console.log('🎯 Setting up betting room with amount:', betAmountInEther, 'MON');
            // ✅ SIMPLE: Use pre-deployed contract (like Bombandak uses fixed contract)
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate setup delay
            const contractAddress = BETTING_CONTRACT_ADDRESS;
            setDeployedAddress(contractAddress);
            setIsDeploying(false);
            console.log('✅ Betting room ready at:', contractAddress);
            return contractAddress;
        }
        catch (error) {
            console.error('❌ Failed to setup betting room:', error);
            setIsDeploying(false);
            throw error;
        }
    };
    return {
        deployContract,
        isDeploying,
        deployedAddress,
        deployTxHash: undefined,
        isSuccess: !!deployedAddress,
        error: null,
    };
}
