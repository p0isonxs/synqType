import { useEffect, useState } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { useUserData } from "../contexts/UserContext";
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface ConnectWalletScreenProps {
    onWalletConnected: () => void;
}

export default function ConnectWalletScreen({ onWalletConnected }: ConnectWalletScreenProps) {
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

    return (
        <div className="min-h-screen bg-black flex flex-col">



            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center px-8 ">
                <div className="max-w-4xl w-full text-center">

                    {/* Hero Section */}
                    <div className="mb-10">
                        <img
                            src="/logo.png"
                            alt="Avatar"
                            className="h-50 w-auto mx-auto"
                        />
                    </div>
                    <div className="-mb-6">


                        {/* Status Display */}
                        {isChecking ? (
                            <div className="mb-12">
                                <div className="inline-flex items-center space-x-3 bg-green-900/30 px-6 py-3 rounded-full border border-green-700">
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-400 border-t-transparent"></div>
                                    <span className="text-green-400 font-medium">
                                        Connected - Setting up your profile
                                    </span>
                                </div>
                            </div>
                        ) : isConnected ? (
                            <div className="mb-12">
                                <div className="inline-flex flex-col items-center space-y-3 bg-green-900/30 px-8 py-4 rounded-2xl border border-green-700">
                                    <div className="text-green-400 font-semibold">
                                        Wallet Connected
                                    </div>
                                    <div className="text-gray-300 font-mono text-sm bg-gray-800 px-4 py-2 rounded-lg border border-gray-600">
                                        {address?.slice(0, 8)}...{address?.slice(-6)}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mb-12">

                                <div className="txt-connect">
                                Synq Type is a fast-paced browser typing game built on Monad and 
                                powered by Multisynq technology
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Connect Button Section */}
                    <div className="flex justify-center mb-16">
                        <ConnectButton.Custom>
                            {({
                                account,
                                chain,
                                openAccountModal,
                                openChainModal,
                                openConnectModal,
                                mounted,
                            }) => {
                                const ready = mounted;
                                const connected = ready && account && chain;

                                return (
                                    <div
                                        className="w-full max-w-sm"
                                        {...(!ready && {
                                            'aria-hidden': true,
                                            style: {
                                                opacity: 0,
                                                pointerEvents: 'none',
                                                userSelect: 'none',
                                            },
                                        })}
                                    >
                                        {(() => {
                                            if (!connected) {
                                                return (
                                                    <button
                                                        onClick={() => {
                                                            playClickSound();
                                                            openConnectModal();
                                                        }}
                                                        className="btn-p0 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
                                                    >
                                                        Connect Wallet
                                                    </button>
                                                );
                                            }

                                            if (chain.unsupported) {
                                                return (
                                                    <button
                                                        onClick={() => {
                                                            playClickSound();
                                                            openChainModal();
                                                        }}
                                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-200"
                                                    >
                                                        Switch Network
                                                    </button>
                                                );
                                            }

                                            return (
                                                <div className="w-full space-y-4">
                                                    <button
                                                        onClick={() => {
                                                            playClickSound();
                                                            openAccountModal();
                                                        }}
                                                        className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200"
                                                    >
                                                        {account.displayName}
                                                    </button>

                                                    {!isChecking && (
                                                        <button
                                                            onClick={() => {
                                                                playClickSound();
                                                                onWalletConnected();
                                                            }}
                                                            className="btn-p0 transition-all duration-200 transform hover:scale-105"
                                                        >
                                                            Continue to Setup
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            }}
                        </ConnectButton.Custom>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="w-full py-6 px-8 border-t border-gray-800">
                <div className="text-center">
                    <p className="text-gray-500 text-sm">
                        Supports MetaMask, Phantom Wallet, Coinbase Wallet and more
                    </p>
                </div>
            </footer>
        </div>
    );
}