import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import yaml from 'yaml';

function loadTemplates() {
  const TEMPLATES_YAML_PATH = path.join(process.cwd(), 'public', 'data', 'templates.yaml');

  console.info('Loading frontmatter config...');
  const frontmatterPath = path.join(process.cwd(), '..', 'frontmatter.json');
  const frontmatterContent = fs.readFileSync(frontmatterPath, 'utf8');
  const frontmatterConfig = JSON.parse(frontmatterContent);
  const templateFolders = frontmatterConfig['frontMatter.content.pageFolders'].map(
    folder => folder.path.replace('[[workspace]]/', '')
  );

  const templates = [];

  console.info('Processing template folders...');
  for (const folder of templateFolders) {
    const readmePath = path.join(process.cwd(), '..', folder, 'README.md');

    try {
      const fileContent = fs.readFileSync(readmePath, 'utf8');
      // Remove HTML comments around front matter, allowing for multiple dashes
      const cleanContent = fileContent.replace(/[-]*<![-]+\s*(---[\s\S]*?---)\s*[-]+>[-]*/, '$1');
      const { data } = matter(cleanContent);

      const template = {
        id: data.id,
        title: data.title,
        description: data.description,
        longDescription: data.longDescription,
        featuresList: data.featuresList,
        tags: data.tags,
        githubUrl: data.githubUrl,
        imageUrl: data.imageUrl,
        author: data.author,
        language: data.language,
        demoUrlGif: data.demoUrlGif,
        demoYoutubeVideoId: data.demoYoutubeVideoId,
      };

      templates.push(template);
    } catch (error) {
      console.error(`Error processing template in ${folder}:`, error);
    }
  }

  const dir = path.dirname(TEMPLATES_YAML_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.info('Writing templates to YAML...');
  fs.writeFileSync(TEMPLATES_YAML_PATH, yaml.stringify({ templates }));

  return templates;
}

loadTemplates();
