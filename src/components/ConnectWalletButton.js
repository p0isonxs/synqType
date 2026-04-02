import { jsx as _jsx } from "react/jsx-runtime";
import { ConnectButton } from '@rainbow-me/rainbowkit';
export function WalletConnect() {
    return (_jsx(ConnectButton.Custom, { children: ({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted, }) => {
            const ready = mounted;
            const connected = ready && account && chain;
            return (_jsx("div", { ...(!ready && {
                    'aria-hidden': true,
                    style: {
                        opacity: 0,
                        pointerEvents: 'none',
                        userSelect: 'none',
                    },
                }), children: (() => {
                    if (!connected) {
                        return (_jsx("button", { onClick: openConnectModal, className: "px-4 py-2 bg-gray-800 text-white rounded-xl border border-gray-600 hover:bg-gray-800 font-semibold transition-all duration-200 shadow hover:shadow-md", children: "Connect Wallet" }));
                    }
                    if (chain.unsupported) {
                        return (_jsx("button", { onClick: openChainModal, className: "px-4 py-2 bg-red-700 text-white rounded-xl border border-red-500 hover:bg-red-800 font-semibold shadow hover:shadow-md", children: "Wrong Network" }));
                    }
                    return (_jsx("div", { className: "flex gap-2", children: _jsx("button", { onClick: openAccountModal, className: "px-5 py-2 font-staatliches  bg-gray-800 text-white rounded-xl border border-gray-600 hover:bg-gray-800 font-semibold transition-all duration-200 shadow hover:shadow-md font-mono", children: account.displayName }) }));
                })() }));
        } }));
}
