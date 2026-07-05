import { AuthGate } from "./components/AuthGate";
import { ChatWindow } from "./components/ChatWindow";

export default function Home() {
  return (
    <AuthGate>
      <ChatWindow />
    </AuthGate>
  );
}
