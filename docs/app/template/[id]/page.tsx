import { loadTemplates, Template } from '@/app/page';
import TemplateDetails from '@/app/components/TemplateDetails/TemplateDetails';
import { Metadata } from 'next';

const TEMPLATES = loadTemplates();

export async function generateStaticParams() {
  let templates: Template[] = [];
  try {
    templates = TEMPLATES;
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
    templates = TEMPLATES;
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
    return TEMPLATES.find((template: Template) => template.id === id) || null;
  } catch (error) {
    console.error('Error loading template:', error);
    return null;
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await getTemplate(id);

  if (!template) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h1 className="text-2xl font-semibold">Template not found</h1>
      </div>
    );
  }

  return <TemplateDetails {...template} />;
}
