import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import "./index.css";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { UserProvider } from "./contexts/UserContext";
import { Web3Provider } from "./contexts/Web3Context";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./config/wagmi";
import { Toaster } from "react-hot-toast";
import { midnightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import '@rainbow-me/rainbowkit/styles.css';
const queryClient = new QueryClient();
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(WagmiProvider, { config: config, children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(BrowserRouter, { children: _jsx(UserProvider, { children: _jsx(Web3Provider, { children: _jsxs(_Fragment, { children: [_jsx(Toaster, { position: "top-right", toastOptions: {
                                        style: {
                                            background: "#111",
                                            color: "#fff",
                                            border: "1px solid #444",
                                            fontFamily: "monospace",
                                        },
                                        success: {
                                            iconTheme: {
                                                primary: "#10B981",
                                                secondary: "#000",
                                            },
                                        },
                                        error: {
                                            iconTheme: {
                                                primary: "#F43F5E",
                                                secondary: "#000",
                                            },
                                        },
                                    } }), _jsx(RainbowKitProvider, { theme: midnightTheme(), modalSize: "compact", children: _jsx(App, {}) })] }) }) }) }) }) }) }));
