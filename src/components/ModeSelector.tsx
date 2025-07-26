import { useNavigate } from "react-router";
import { useState, useCallback } from "react";
import { useSound } from "../contexts/UserContext";
import RoyaleComingSoonModal from "./RoyaleComingSoonModal";
import { MODE_CONFIG, NAVIGATION_DELAY } from "../config/mode";
import { useWeb3 } from "../contexts/Web3Context";
import { WalletConnect } from "./ConnectWalletButton";

export default function ModeSelector() {
  const navigate = useNavigate();
  const { playClickSound } = useSound();
  const [showModal, setShowModal] = useState(false);
  const { disconnect, isConnected, } = useWeb3();
  const handleReset = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const handleLogout = async () => {
    playClickSound();

    try {
      await disconnect();

      localStorage.clear();

      sessionStorage.clear();

      setTimeout(() => {
        window.location.href = '/';
      }, 300);

    } catch (error) {
      console.error('Logout error:', error);
      handleReset();
    }
  };
  const handleModeNavigation = useCallback(
    (path: string) => {
      playClickSound();
      setTimeout(() => {
        navigate(path);
      }, NAVIGATION_DELAY);
    },
    [navigate, playClickSound]
  );

  const handleSoloClick = useCallback(() => {
    handleModeNavigation(MODE_CONFIG.SOLO.path);
  }, [handleModeNavigation]);

  const handleRoyaleClick = useCallback(() => {
    handleModeNavigation(MODE_CONFIG.ROYALE.path);
  }, [handleModeNavigation]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-black text-white relative overflow-hidden">
      <header>
        <h1 className="font-staatliches text-5xl font-bold mb-10">MODE</h1>
      </header>

      <div className="absolute top-4 right-4 flex items-center gap-4">

        <WalletConnect />
      </div>


      <main className="flex gap-4 z-10">
        <button 
          type="button"
          className=" btn-modeselector  px-6 py-2   hover:opacity-80 transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
          onClick={handleSoloClick}
          aria-label="Play solo mode"
        >
          {MODE_CONFIG.SOLO.label}
        </button>

        <button
          type="button"
          className="btn-modeselector  px-6 py-2  hover:opacity-80 transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
          onClick={handleRoyaleClick}
          aria-label="Play royale mode"
        >
          {MODE_CONFIG.ROYALE.label}
        </button>
      </main>

      {/* Modal */}
      {showModal && <RoyaleComingSoonModal onClose={handleCloseModal} />}
    </div>
  );
}
