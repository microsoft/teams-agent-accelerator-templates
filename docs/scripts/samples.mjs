import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import yaml from 'yaml';

function loadSamples() {
  const TEMPLATES_YAML_PATH = path.join(process.cwd(), 'public', 'data', 'samples.yaml');

  console.info('Loading frontmatter config...');
  const frontmatterPath = path.join(process.cwd(), '..', 'frontmatter.json');
  const frontmatterContent = fs.readFileSync(frontmatterPath, 'utf8');
  const frontmatterConfig = JSON.parse(frontmatterContent);
  const sampleFolders = frontmatterConfig['frontMatter.content.pageFolders'].map(
    folder => folder.path.replace('[[workspace]]/', '')
  );

  const samples = [];

  console.info('Processing sample folders...');
  for (const folder of sampleFolders) {
    const readmePath = path.join(process.cwd(), '..', folder, 'README.md');

    try {
      const fileContent = fs.readFileSync(readmePath, 'utf8');
      const { data } = matter(fileContent);

      const sample = {
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
      };

      samples.push(sample);
    } catch (error) {
      console.error(`Error processing sample in ${folder}:`, error);
    }
  }

  const dir = path.dirname(TEMPLATES_YAML_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.info('Writing samples to YAML...');
  fs.writeFileSync(TEMPLATES_YAML_PATH, yaml.stringify({ samples }));

  return samples;
}

loadSamples();
