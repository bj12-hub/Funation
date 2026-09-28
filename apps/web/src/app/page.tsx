import { GlobalHeader } from "@/components/layout/GlobalHeader";

export default function HomePage() {
  // TODO: replace with the server session once authentication is implemented.
  const user = null;

  return (
    <>
      <GlobalHeader user={user} />
      <main />
    </>
  );
}
