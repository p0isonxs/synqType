import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router";
import { useEffect, useState, useCallback } from "react";
import { LOBBY_CONTENT, ROOM_CODE_CONFIG } from "../config/loby";
import { useUserData } from "../contexts/UserContext";
export default function MultiplayerLobby() {
    const navigate = useNavigate();
    const [joinedCode, setJoinedCode] = useState("");
    const { userData, updateUserData } = useUserData();
    // Authentication check
    useEffect(() => {
        if (!userData.initials) {
            navigate("/");
        }
    }, [navigate, userData.initials]);
    const handleCreateRoom = useCallback(() => {
        navigate("/create-room");
    }, [navigate]);
    const handleJoinRoom = useCallback(() => {
        const trimmedCode = joinedCode.trim();
        if (!trimmedCode)
            return;
        const roomCode = trimmedCode.toUpperCase();
        updateUserData({ roomSettings: {} });
        navigate(`/room/${roomCode}/lobby`);
    }, [joinedCode, navigate, updateUserData]);
    const handleBackNavigation = useCallback(() => {
        navigate("/mode");
    }, [navigate]);
    const handleCodeChange = useCallback((e) => {
        setJoinedCode(e.target.value.toUpperCase());
    }, []);
    const handleKeyDown = useCallback((e) => {
        if (e.key === "Enter" && joinedCode.trim()) {
            handleJoinRoom();
        }
    }, [joinedCode, handleJoinRoom]);
    return (_jsxs("div", { className: "min-h-screen bg-black flex flex-col", children: [_jsxs("div", { className: "flex justify-between items-center p-4", children: [_jsx("button", { type: "button", onClick: handleBackNavigation, className: "px-4 py-2 bg-gray-800 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg border border-gray-600 transition-all duration-200 text-sm", "aria-label": "Go back to mode selection", children: "\u2190 Back" }), _jsxs("div", { className: "text-gray-400 text-sm", children: ["Mode ", _jsx("span", { className: "text-white font-mono", children: "multiplayer" })] })] }), _jsx("div", { className: "flex-1 flex items-center justify-center px-8", children: _jsxs("div", { className: "max-w-4xl w-full text-center", children: [_jsx("h1", { className: "text-white text-5xl font-bold mb-2 ", style: { fontFamily: "Staatliches" }, children: LOBBY_CONTENT.TITLE }), _jsx("p", { style: { fontFamily: "Staatliches" }, className: "text-gray-400 text-lg mb-12", children: LOBBY_CONTENT.SUBTITLE }), _jsxs("div", { className: "max-w-md mx-auto", children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { htmlFor: "room-code", className: "block text-gray-300 text-sm font-medium mb-2 text-left", style: { fontFamily: "Staatliches", fontSize: "19px" }, children: LOBBY_CONTENT.JOIN_ROOM.label }), _jsx("input", { id: "room-code", type: "text", placeholder: LOBBY_CONTENT.JOIN_ROOM.placeholder, value: joinedCode, onChange: handleCodeChange, onKeyDown: handleKeyDown, className: "w-full px-4 py-3  border border-gray-600 rounded-xl text-white  focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all duration-200  font-mono uppercase", maxLength: ROOM_CODE_CONFIG.MAX_LENGTH, autoComplete: "off" })] }), _jsx("button", { type: "button", onClick: handleCreateRoom, className: "btn-multiplayerLobby w-full  py-3 px-6 rounded-xl  transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black mb-2", children: LOBBY_CONTENT.CREATE_ROOM.button }), _jsx("button", { type: "button", onClick: handleJoinRoom, disabled: !joinedCode.trim(), className: "btn-multiplayerLobby w-full   py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed  transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black", children: joinedCode.trim() ? `Join Room ${joinedCode}` : "Enter Room Code" })] })] }) }), _jsx("footer", { className: "w-full py-6 px-8 border-t border-gray-800", children: _jsx("div", { className: "text-center", children: _jsx("p", { className: "text-gray-500 text-sm", children: LOBBY_CONTENT.FOOTER }) }) })] }));
}
