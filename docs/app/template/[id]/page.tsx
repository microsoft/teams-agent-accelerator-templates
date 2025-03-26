import { parse } from 'yaml';
import { Template } from '@/app/components/TemplateGallery/TemplateGallery';
import fs from 'fs/promises';
import TemplateDetails from '@/app/components/TemplateDetails/TemplateDetails';
import { Metadata } from 'next';

export async function generateStaticParams() {
    let templates = [];
    try {
        const response = await fs.readFile('public/data/templates.yaml', 'utf8');
        templates = parse(response).templates;
    } catch (error) {
        console.error('Error loading templates:', error);
    }

    return templates.map((template: Template) => ({
        id: template.id,
    }))
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
    let templates = [];
    try {
        const response = await fs.readFile('public/data/templates.yaml', 'utf8');
        templates = parse(response).templates;
    } catch (error) {
        console.error('Error loading templates:', error);
    }

    const template = templates.find((t: Template) => t.id === params.id);

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

export default async function Page({
    params,
}: {
    params: { id: string }
}) {
    const template = await getTemplate(params.id);

    if (!template) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <h1 className="text-2xl font-semibold">Template not found</h1>
            </div>
        );
    }

    return <TemplateDetails {...template} />;
}