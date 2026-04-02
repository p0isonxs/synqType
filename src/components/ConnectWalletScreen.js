import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { useUserData } from "../contexts/UserContext";
import { ConnectButton } from '@rainbow-me/rainbowkit';
export default function ConnectWalletScreen({ onWalletConnected }) {
    const { isConnected, address } = useWeb3();
    const { playClickSound } = useUserData();
    const [isChecking, setIsChecking] = useState(false);
    useEffect(() => {
        if (isConnected && address) {
            setIsChecking(true);
            setTimeout(() => {
                playClickSound();
                onWalletConnected();
            }, 1000);
        }
    }, [isConnected, address, onWalletConnected, playClickSound]);
    return (_jsxs("div", { className: "min-h-screen bg-black flex flex-col", children: [_jsx("div", { className: "flex-1 flex items-center justify-center px-8 ", children: _jsxs("div", { className: "max-w-4xl w-full text-center", children: [_jsx("div", { className: "mb-10", children: _jsx("img", { src: "/logo.png", alt: "Avatar", className: "h-50 w-auto mx-auto" }) }), _jsx("div", { className: "-mb-6", children: isChecking ? (_jsx("div", { className: "mb-12", children: _jsxs("div", { className: "inline-flex items-center space-x-3 bg-green-900/30 px-6 py-3 rounded-full border border-green-700", children: [_jsx("div", { className: "animate-spin rounded-full h-5 w-5 border-2 border-green-400 border-t-transparent" }), _jsx("span", { className: "text-green-400 font-medium", children: "Connected - Setting up your profile" })] }) })) : isConnected ? (_jsx("div", { className: "mb-12", children: _jsxs("div", { className: "inline-flex flex-col items-center space-y-3 bg-green-900/30 px-8 py-4 rounded-2xl border border-green-700", children: [_jsx("div", { className: "text-green-400 font-semibold", children: "Wallet Connected" }), _jsxs("div", { className: "text-gray-300 font-mono text-sm bg-gray-800 px-4 py-2 rounded-lg border border-gray-600", children: [address?.slice(0, 8), "...", address?.slice(-6)] })] }) })) : (_jsx("div", { className: "mb-12", children: _jsx("div", { className: "txt-connect", children: "Synq Type is a fast-paced browser typing game built on Monad and powered by Multisynq technology" }) })) }), _jsx("div", { className: "flex justify-center mb-16", children: _jsx(ConnectButton.Custom, { children: ({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted, }) => {
                                    const ready = mounted;
                                    const connected = ready && account && chain;
                                    return (_jsx("div", { className: "w-full max-w-sm", ...(!ready && {
                                            'aria-hidden': true,
                                            style: {
                                                opacity: 0,
                                                pointerEvents: 'none',
                                                userSelect: 'none',
                                            },
                                        }), children: (() => {
                                            if (!connected) {
                                                return (_jsx("button", { onClick: () => {
                                                        playClickSound();
                                                        openConnectModal();
                                                    }, className: "btn-p0 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black", children: "Connect Wallet" }));
                                            }
                                            if (chain.unsupported) {
                                                return (_jsx("button", { onClick: () => {
                                                        playClickSound();
                                                        openChainModal();
                                                    }, className: "w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-200", children: "Switch Network" }));
                                            }
                                            return (_jsxs("div", { className: "w-full space-y-4", children: [_jsx("button", { onClick: () => {
                                                            playClickSound();
                                                            openAccountModal();
                                                        }, className: "w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200", children: account.displayName }), !isChecking && (_jsx("button", { onClick: () => {
                                                            playClickSound();
                                                            onWalletConnected();
                                                        }, className: "btn-p0 transition-all duration-200 transform hover:scale-105", children: "Continue to Setup" }))] }));
                                        })() }));
                                } }) })] }) }), _jsx("footer", { className: "w-full py-6 px-8 border-t border-gray-800", children: _jsx("div", { className: "text-center", children: _jsx("p", { className: "text-gray-500 text-sm", children: "Supports MetaMask, Phantom Wallet, Coinbase Wallet and more" }) }) })] }));
}
