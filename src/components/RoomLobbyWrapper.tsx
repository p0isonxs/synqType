import { useParams, Navigate, useLocation } from "react-router";
import { MultisynqRoot } from "@multisynq/react";
import { useEffect } from "react";
import RoomLobby from "./RoomLobby";
import { RoomTypingModel } from "../multisynq/RoomTypingModel";
import { useUserData } from "../contexts/UserContext";

export default function RoomLobbyWrapper() {
  const { code } = useParams();
  const location = useLocation();
  const { userData, updateUserData } = useUserData();
  const canEnterRoom = Boolean(code && userData.initials && userData.avatarUrl);

  useEffect(() => {
    if (!canEnterRoom) return;

    const isHost = Boolean(
      location.state && Object.keys(location.state as object).length > 0
    );

    if (isHost && location.state) {
      updateUserData({ roomSettings: location.state as Record<string, unknown> });
    }
  }, [canEnterRoom, location.state, updateUserData]);

  useEffect(() => {
    if (!canEnterRoom) return;

    if (userData.roomSettings && Object.keys(userData.roomSettings).length > 0) {
      RoomTypingModel.setRoomSettings(userData.roomSettings);
    }
  }, [canEnterRoom, userData.roomSettings]);

  if (!canEnterRoom) {
    return <Navigate to="/" />;
  }

  return (
    <MultisynqRoot
      sessionParams={{
        model: RoomTypingModel,
        appId: import.meta.env.VITE_MULTISYNQ_APP_ID,
        apiKey: import.meta.env.VITE_MULTISYNQ_API_KEY,
        name: `typing-room-${code}`,
        password: `pw-${code}`,
      }}
    >
      <RoomLobby />
    </MultisynqRoot>
  );
}
