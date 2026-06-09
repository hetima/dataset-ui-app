import { ThemeProvider } from "next-themes";
import { PlayerView } from "./views/PlayerView";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <PlayerView />
      <Toaster />
    </ThemeProvider>
  );
}
