import { redirect } from "next/navigation";

export default function Home() {
  // Slice 1 only ships the capture panel; the root window is a placeholder.
  redirect("/capture");
}
