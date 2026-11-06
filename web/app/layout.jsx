import './globals.css';
import AppShell from '../src/AppShell';
export const metadata = { title: 'CampusOS', description: 'Local college administration and DBMS study companion' };
export default function RootLayout({children}) { return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning><AppShell>{children}</AppShell></body></html>; }
