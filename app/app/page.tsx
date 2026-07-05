import { AuthGate } from "../components/AuthGate";
import { ChatWindow } from "../components/ChatWindow";

export default function AppPage() {
  return (
    <AuthGate>
      <ChatWindow />
    </AuthGate>
  );
}
