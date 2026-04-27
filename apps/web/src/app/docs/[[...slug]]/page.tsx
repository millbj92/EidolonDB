import { source } from '@/lib/source';
import { DocsPage, DocsBody } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  const data = page.data as unknown as {
    title: string;
    toc?: import('fumadocs-core/toc').TOCItemType[];
    body: React.ComponentType<{ components?: unknown }>;
  };
  const MDX = data.body;
  return (
    <DocsPage toc={data.toc}>
      <DocsBody>
        <h1>{data.title}</h1>
        <MDX components={defaultMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}
