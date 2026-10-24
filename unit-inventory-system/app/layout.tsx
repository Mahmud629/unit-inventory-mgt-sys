import "./globals.css";
import AppShell from "./components/AppShell";

export const metadata = {
  title: "5 Signal Battalion Inventory",
  description: "Unit Property Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}