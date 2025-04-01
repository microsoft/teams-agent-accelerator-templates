import TemplateGallery from './components/TemplateGallery/TemplateGallery';
import Header from './components/Header/Header';
import { parse } from 'yaml';
import fs from 'fs';
import Root from './components/Root/Root';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

export interface Template {
  id: string;
  title: string;
  description: string;
  tags: string[];
  githubUrl: string;
  imageUrl: string;
  author: string;
  language: string;
  demoUrlGif: string;
  longDescription: string; // html string (rendered markdown)
  featuresList: string[]; // html strings (rendered markdown)
}

export type TemplateGalleryData = Template[];

function renderMarkdown(text: string): string {
  const content = unified()
    .use(remarkParse)
    .use(remarkBreaks)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .processSync(text);

  return String(content);
}

export function loadTemplates(): TemplateGalleryData {
  const response = fs.readFileSync('public/data/templates.yaml', 'utf8');
  const templates = parse(response).templates;

  const renderedTemplates = templates.map((template: Template) => {
    if (template?.longDescription) {
      template.longDescription = renderMarkdown(template.longDescription);
    }

    if (template?.featuresList) {
      template.featuresList = template.featuresList.map((feature: string) =>
        renderMarkdown(feature)
      );
    }

    return template;
  });

  return renderedTemplates;
}

const TEMPLATES = loadTemplates();

export default function Home() {
  const templates = TEMPLATES;

  return (
    <Root>
      <Header />
      <TemplateGallery templates={templates} />
    </Root>
  );
}
