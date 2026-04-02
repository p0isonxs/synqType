import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    const [initials, setInitials] = useState(() => {
        const initial = userData.initials;
        return initial && initial !== "" ? initial : null;
    });
    const { isConnected } = useWeb3(); // ✅ ADD: Import useWeb3
    // ✅ ADD: Wallet connection state
    const [walletConnected, setWalletConnected] = useState(() => {
        // Check if wallet was previously connected
        return localStorage.getItem("walletConnected") === "true";
    });
    const [avatar, setAvatar] = useState(() => {
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
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: 
                // ✅ UPDATED: Three-step authentication flow
                !walletConnected ? (_jsx(ConnectWalletScreen, { onWalletConnected: handleWalletConnected })) : !isAuthenticated ? (_jsx(UsernameInput, { onSubmit: (name, avatarUrl) => {
                        updateUserData({ initials: name, avatarUrl });
                        setInitials(name);
                        setAvatar(avatarUrl);
                    } })) : (_jsx(Navigate, { to: "/mode" })) }), _jsx(Route, { path: "/mode", element: walletConnected && isAuthenticated ? _jsx(ModeSelector, {}) : _jsx(Navigate, { to: "/" }) }), _jsx(Route, { path: "/settings", element: walletConnected && isAuthenticated ? _jsx(RoomSettings, {}) : _jsx(Navigate, { to: "/" }) }), _jsx(Route, { path: "/single", element: walletConnected && isAuthenticated ? _jsx(SinglePlayer, {}) : _jsx(Navigate, { to: "/" }) }), _jsx(Route, { path: "/multiplayer", element: walletConnected && isAuthenticated ? _jsx(MultiplayerLobby, {}) : _jsx(Navigate, { to: "/" }) }), _jsx(Route, { path: "/create-room", element: walletConnected && isAuthenticated ? _jsx(RoomSettings, { mode: "create" }) : _jsx(Navigate, { to: "/" }) }), _jsx(Route, { path: "/room/:code/lobby", element: walletConnected && isAuthenticated ? _jsx(RoomLobbyWrapper, {}) : _jsx(Navigate, { to: "/" }) }), _jsx(Route, { path: "/room/:code", element: walletConnected && isAuthenticated ? _jsx(RoomGameWrapper, {}) : _jsx(Navigate, { to: "/" }) })] }));
}
