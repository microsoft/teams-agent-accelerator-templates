import { parse } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { Template } from '@/app/components/TemplateGallery/TemplateGallery';
import fs from 'fs/promises';
import TemplateDetails from '@/app/components/TemplateDetails/TemplateDetails';
import { Metadata } from 'next';

export async function generateStaticParams() {
  let templates: Template[] = [];
  try {
    const response = await fs.readFile('public/data/templates.yaml', 'utf8');
    templates = parse(response).templates;
  } catch (error) {
    console.error('Error loading templates:', error);
  }

  return templates.map((template: Template) => ({
    id: template.id,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  let templates: Template[] = [];
  try {
    const response = await fs.readFile('public/data/templates.yaml', 'utf8');
    templates = parse(response).templates;
  } catch (error) {
    console.error('Error loading templates:', error);
  }

  const { id } = await params;
  const template = templates.find((t: Template) => t.id === id);

  if (!template) {
    return {
      title: 'Template Not Found',
    };
  }

  return {
    title: `${template.title} - Teams Agent Accelerator Templates`,
    description: template.description,
  };
}

async function getTemplate(id: string): Promise<Template | null> {
  try {
    const response = await fs.readFile('public/data/templates.yaml', 'utf8');
    const templates = parse(response).templates;
    return templates.find((template: Template) => template.id === id) || null;
  } catch (error) {
    console.error('Error loading template:', error);
    return null;
  }
}

function renderMarkdown(text: string): string {
  const content = unified()
  .use(remarkParse)
  .use(remarkBreaks)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify)
  .processSync(text)

  return String(content)
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await getTemplate(id);

  if (template?.longDescription) {
    template.longDescription = renderMarkdown(template.longDescription);
  }

  if (template?.featuresList) {
    template.featuresList = template.featuresList.map((feature: string) => renderMarkdown(feature));
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h1 className="text-2xl font-semibold">Template not found</h1>
      </div>
    );
  }

  return <TemplateDetails {...template} />;
}
