import { auth } from '@/auth';
import { Navigation } from '@/components/Navigation';
import { Page } from '@/components/PageLayout';
import { redirect } from 'next/navigation';

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // If the user is not authenticated, redirect to the landing page
  if (!session) {
    redirect('/');
  }

  return (
    <Page>
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
      <Page.Footer className="nav-footer px-0 flex-shrink-0 w-full bg-[#171717] border-t border-white/10 touch-none">
        <Navigation />
      </Page.Footer>
    </Page>
  );
}
