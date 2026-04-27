import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout tree={source.pageTree} nav={{ title: 'Eidolon Docs' }}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
