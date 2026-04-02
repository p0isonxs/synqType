import { useParams, Navigate } from "react-router";
import { MultisynqRoot } from "@multisynq/react";
import { useEffect } from "react";
import { RoomTypingModel } from "../multisynq/RoomTypingModel";
import TypingGame from "../TypingGame";
import { useUserData } from "../contexts/UserContext";

export default function RoomGameWrapper() {
  const { code } = useParams();
  const { userData } = useUserData();
  const canEnterRoom = Boolean(code && userData.initials && userData.avatarUrl);

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
      key={`game-${code}`}
      sessionParams={{
        model: RoomTypingModel,
        appId: import.meta.env.VITE_MULTISYNQ_APP_ID,
        apiKey: import.meta.env.VITE_MULTISYNQ_API_KEY,
        name: `typing-room-${code}`,
        password: `pw-${code}`,
      }}
    >
      <TypingGame roomCode={code} />
    </MultisynqRoot>
  );
}
