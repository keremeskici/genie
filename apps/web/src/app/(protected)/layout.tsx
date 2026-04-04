import { auth } from '@/auth';
import { Navigation } from '@/components/Navigation';
import { Page } from '@/components/PageLayout';

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // If the user is not authenticated, redirect to the login page
  if (!session) {
    console.log('Not authenticated');
    // redirect('/');
  }

  return (
    <Page>
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
      <Page.Footer className="px-0 flex-shrink-0 w-full bg-[#171717] border-t border-white/10 touch-none">
        <Navigation />
      </Page.Footer>
    </Page>
  );
}
