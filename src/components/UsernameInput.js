import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
//✅ CONTEXT FIX - src/components/UsernameInput.tsx
import { useState, useCallback, useMemo } from "react";
import { useUserData } from "../contexts/UserContext"; // ✅ Updated import
import { validateUsername, } from "../validation/userValidation";
import { AVATAR_CONFIG } from "../config/avatars";
import { LoadingSpinner } from "./ui/LoadingSpinner";
import { ErrorMessage } from "./ui/ErrorMessage";
import { getNetworkInfo } from "../config/bettingContract";
export default function UsernameInput({ onSubmit }) {
    // ✅ FIXED: Use UserContext for both sound and data management
    const { playClickSound, updateUserData } = useUserData();
    const networkInfo = getNetworkInfo();
    const [formState, setFormState] = useState({
        username: "",
        selectedAvatar: AVATAR_CONFIG.avatars[0],
        isSubmitting: false,
        error: null,
    });
    const { username, selectedAvatar, isSubmitting, error } = formState;
    // Memoized validation result
    const validationError = useMemo(() => {
        if (!username)
            return null;
        return validateUsername(username);
    }, [username]);
    const isFormValid = username.trim().length > 0 && !validationError;
    const updateFormState = useCallback((updates) => {
        setFormState((prev) => ({ ...prev, ...updates }));
    }, []);
    const handleUsernameChange = useCallback((e) => {
        const newUsername = e.target.value;
        updateFormState({
            username: newUsername,
            error: null, // Clear error on input change
        });
    }, [updateFormState]);
    const handleAvatarSelect = useCallback((avatar) => {
        playClickSound();
        updateFormState({ selectedAvatar: avatar });
    }, [playClickSound, updateFormState]);
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!isFormValid || isSubmitting)
            return;
        try {
            updateFormState({ isSubmitting: true, error: null });
            playClickSound();
            const trimmedUsername = username.trim();
            // Simulate async validation (e.g., checking username availability)
            await new Promise((resolve) => setTimeout(resolve, 300));
            // ✅ FIXED: Use UserContext instead of storage utility
            updateUserData({
                initials: trimmedUsername,
                avatarUrl: selectedAvatar,
            });
            onSubmit(trimmedUsername, selectedAvatar);
        }
        catch (err) {
            updateFormState({
                error: {
                    field: "general",
                    message: "Failed to save user data. Please try again.",
                },
            });
        }
        finally {
            updateFormState({ isSubmitting: false });
        }
    }, [
        isFormValid,
        isSubmitting,
        username,
        selectedAvatar,
        playClickSound,
        updateFormState,
        updateUserData, // ✅ Updated dependency
        onSubmit,
    ]);
    const handleKeyDown = useCallback((e, avatar) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleAvatarSelect(avatar);
        }
    }, [handleAvatarSelect]);
    return (_jsx("div", { className: "min-h-screen bg-black flex flex-col items-center justify-center p-4", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsx("div", { className: "text-center mb-8", children: _jsx("div", { className: "mb-4", children: _jsx("img", { src: "/logo.png", alt: "SYNQ TYPE ROYALE", className: "mx-auto h-24 w-auto" }) }) }), _jsxs("div", { className: "bg-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-700", children: [_jsx("div", { className: "flex justify-center mb-4", children: _jsx("div", { className: "relative", children: _jsx("img", { src: selectedAvatar, alt: "Selected avatar", className: "w-25 h-25" }) }) }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [error?.field === "general" && (_jsx(ErrorMessage, { message: error.message })), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block k-19 text-gray-300 uppercase tracking-wide", children: "Username" }), _jsx("input", { id: "username", type: "text", placeholder: "Enter your username", value: username, onChange: handleUsernameChange, "aria-invalid": !!validationError, "aria-describedby": validationError ? "username-error" : undefined, className: `w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all duration-200 ${validationError
                                                ? "border-red-500 focus:ring-red-500"
                                                : "border-gray-600"}`, maxLength: 20, required: true, disabled: isSubmitting }), validationError && (_jsx("p", { id: "username-error", className: "text-red-400 text-sm mt-1", role: "alert", children: validationError.message }))] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block k-19 mb-8 text-gray-300 uppercase tracking-wide", children: "Choose Your Avatar" }), _jsx("div", { className: "grid grid-cols-3 gap-3 justify-items-center mx-auto max-w-xs", children: AVATAR_CONFIG.avatars.map((avatar, index) => (_jsxs("button", { type: "button", onClick: () => handleAvatarSelect(avatar), onKeyDown: (e) => handleKeyDown(e, avatar), className: `relative w-18 h-18 mb-6 rounded-full border-2 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900 ${selectedAvatar === avatar
                                                    ? "border-white shadow-lg ring-2 ring-white ring-opacity-50"
                                                    : "border-gray-600 hover:border-gray-400"}`, "aria-pressed": selectedAvatar === avatar, "aria-label": `Avatar ${index + 1}`, disabled: isSubmitting, children: [_jsx("img", { src: avatar, alt: "", className: "w-full h-full rounded-full object-cover", loading: "lazy" }), selectedAvatar === avatar && (_jsx("div", { className: "absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-gray-900 flex items-center justify-center", "aria-hidden": "true", children: _jsx("span", { className: "text-xs", children: "\u2713" }) }))] }, avatar))) })] }), _jsx("button", { type: "submit", disabled: !isFormValid || isSubmitting, className: "w-full mt-2 px-6 py-4 bg-white hover:bg-gray-200 text-black font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:bg-gray-600 disabled:text-gray-400", children: _jsxs("span", { className: "font-staatliches flex items-center justify-center gap-2", children: [isSubmitting && _jsx(LoadingSpinner, { size: "sm" }), isSubmitting
                                                ? "Setting up..."
                                                : isFormValid
                                                    ? "Continue"
                                                    : "Enter Username"] }) })] })] }), _jsx("div", { className: "text-center mt-6", children: _jsx("p", { className: "k-19", children: "Choose your avatar and get ready to race!" }) })] }) }));
}
