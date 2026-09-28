import { GlobalHeader } from "@/components/layout/GlobalHeader";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // TODO: replace with the server session once authentication is implemented.
  const user = null;

  return (
    <>
      <GlobalHeader user={user} />
      <main>{children}</main>
    </>
  );
}
