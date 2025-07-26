// src/App.tsx
import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router";
import { useUserData } from "./contexts/UserContext";
import UsernameInput from "./components/UsernameInput";
import ModeSelector from "./components/ModeSelector";
import MultiplayerLobby from "./components/MultiplayerLobby";
import SinglePlayer from "./pages/SinglePlayerGame";
import RoomLobbyWrapper from "./components/RoomLobbyWrapper";
import RoomGameWrapper from "./components/RoomGameWrapper";
import RoomSettings from "./components/RoomSettings";
import ConnectWalletScreen from "./components/ConnectWalletScreen";
import { useWeb3 } from "./contexts/Web3Context";

export default function App() {
  const { userData, updateUserData } = useUserData();

  const [initials, setInitials] = useState<string | null>(() => {
    const initial = userData.initials;
    return initial && initial !== "" ? initial : null;
  });
  const { isConnected } = useWeb3(); // ✅ ADD: Import useWeb3

  // ✅ ADD: Wallet connection state
  const [walletConnected, setWalletConnected] = useState<boolean>(() => {
    // Check if wallet was previously connected
    return localStorage.getItem("walletConnected") === "true";
  });

  const [avatar, setAvatar] = useState<string | null>(() => {
    const avatarUrl = userData.avatarUrl;
    return avatarUrl && avatarUrl !== "/avatars/avatar1.png" ? avatarUrl : null;
  });


  useEffect(() => {
    if (isConnected && !walletConnected) {
      setWalletConnected(true);
      localStorage.setItem("walletConnected", "true");
    }
    if (!isConnected && walletConnected) {
      setWalletConnected(false);
      localStorage.removeItem("walletConnected");
    }
  }, [isConnected, walletConnected]);

  useEffect(() => {
    if (userData.initials && userData.initials !== "" && userData.avatarUrl && userData.avatarUrl !== "/avatars/avatar1.png") {
      setInitials(userData.initials);
      setAvatar(userData.avatarUrl);
    }
  }, [userData.initials, userData.avatarUrl]);

  useEffect(() => {
    const handleStorageChange = () => {
      const storedInitials = localStorage.getItem("initials");
      const storedAvatar = localStorage.getItem("avatarUrl");

      if (!storedInitials || !storedAvatar) {
        setInitials(null);
        setAvatar(null);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const isAuthenticated = initials && avatar && initials !== "";
 const handleWalletConnected = () => {
    setWalletConnected(true);
    localStorage.setItem("walletConnected", "true");
  };

  return (
   <Routes>
      <Route
        path="/"
        element={
          // ✅ UPDATED: Three-step authentication flow
          !walletConnected ? (
            <ConnectWalletScreen onWalletConnected={handleWalletConnected} />
          ) : !isAuthenticated ? (
            <UsernameInput
              onSubmit={(name, avatarUrl) => {
                updateUserData({ initials: name, avatarUrl });
                setInitials(name);
                setAvatar(avatarUrl);
              }}
            />
          ) : (
            <Navigate to="/mode" />
          )
        }
      />

      <Route
        path="/mode"
        element={walletConnected && isAuthenticated ? <ModeSelector /> : <Navigate to="/" />}
      />

      <Route
        path="/settings"
        element={walletConnected && isAuthenticated ? <RoomSettings /> : <Navigate to="/" />}
      />

      <Route
        path="/single"
        element={walletConnected && isAuthenticated ? <SinglePlayer /> : <Navigate to="/" />}
      />

      <Route
        path="/multiplayer"
        element={walletConnected && isAuthenticated ? <MultiplayerLobby /> : <Navigate to="/" />}
      />

      <Route
        path="/create-room"
        element={
          walletConnected && isAuthenticated ? <RoomSettings mode="create" /> : <Navigate to="/" />
        }
      />

      <Route
        path="/room/:code/lobby"
        element={walletConnected && isAuthenticated ? <RoomLobbyWrapper /> : <Navigate to="/" />}
      />

      <Route
        path="/room/:code"
        element={walletConnected && isAuthenticated ? <RoomGameWrapper /> : <Navigate to="/" />}
      />


    </Routes>
  );
}