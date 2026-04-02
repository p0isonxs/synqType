import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import toast from 'react-hot-toast';
const Web3Context = createContext(undefined);
export const Web3Provider = ({ children }) => {
    const { address, isConnected } = useAccount();
    const { connectAsync, connectors, isPending: isConnecting, } = useConnect();
    const { disconnect } = useDisconnect();
    const connect = async () => {
        try {
            const connector = connectors.find(c => c.type === 'injected') || connectors[0];
            await connectAsync({ connector });
            toast.success('Wallet connected successfully!');
        }
        catch (error) {
            console.error('Connection failed:', error);
            toast.error('Failed to connect wallet');
        }
    };
    const shortAddress = address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : null;
    return (_jsx(Web3Context.Provider, { value: {
            address,
            isConnected,
            isConnecting,
            connect,
            disconnect,
            shortAddress
        }, children: children }));
};
export const useWeb3 = () => {
    const context = useContext(Web3Context);
    if (!context)
        throw new Error('useWeb3 must be used inside Web3Provider');
    return context;
};
