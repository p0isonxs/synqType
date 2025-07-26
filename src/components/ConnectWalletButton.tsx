import { ConnectButton } from '@rainbow-me/rainbowkit'

export function WalletConnect() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted
        const connected = ready && account && chain

        return (
          <div
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
                    onClick={openConnectModal}
                    className="px-4 py-2 bg-gray-800 text-white rounded-xl border border-gray-600 hover:bg-gray-800 font-semibold transition-all duration-200 shadow hover:shadow-md"
                  >
                    Connect Wallet
                  </button>
                )
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="px-4 py-2 bg-red-700 text-white rounded-xl border border-red-500 hover:bg-red-800 font-semibold shadow hover:shadow-md"
                  >
                    Wrong Network
                  </button>
                )
              }

              return (
                <div className="flex gap-2">
                  <button
                    onClick={openAccountModal}
                    className="px-5 py-2 font-staatliches  bg-gray-800 text-white rounded-xl border border-gray-600 hover:bg-gray-800 font-semibold transition-all duration-200 shadow hover:shadow-md font-mono"
                  >
                    {account.displayName}
                  </button>
                </div>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
