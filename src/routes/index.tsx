import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/components/ade/CommandCenter";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <CommandCenter />;
}
