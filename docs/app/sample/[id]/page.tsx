import { parse } from 'yaml';
import { Sample } from '@/app/components/SampleGallery/SampleGallery';
import fs from 'fs/promises';
import SampleDetails from '@/app/components/SampleDetails/SampleDetails';
import { Metadata } from 'next';

export async function generateStaticParams() {
  let samples: Sample[] = [];
  try {
    const response = await fs.readFile('public/data/samples.yaml', 'utf8');
    samples = parse(response).samples;
  } catch (error) {
    console.error('Error loading samples:', error);
  }

  return samples.map((sample: Sample) => ({
    id: sample.id,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  let samples: Sample[] = [];
  try {
    const response = await fs.readFile('public/data/samples.yaml', 'utf8');
    samples = parse(response).samples;
  } catch (error) {
    console.error('Error loading samples:', error);
  }

  const { id } = await params;
  const sample = samples.find((t: Sample) => t.id === id);

  if (!sample) {
    return {
      title: 'Sample Not Found',
    };
  }

  return {
    title: `${sample.title} - Teams Agent Accelerator Samples`,
    description: sample.description,
  };
}

async function getSample(id: string): Promise<Sample | null> {
  try {
    const response = await fs.readFile('public/data/samples.yaml', 'utf8');
    const samples = parse(response).samples;
    return samples.find((sample: Sample) => sample.id === id) || null;
  } catch (error) {
    console.error('Error loading sample:', error);
    return null;
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sample = await getSample(id);

  if (!sample) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h1 className="text-2xl font-semibold">Sample not found</h1>
      </div>
    );
  }

  return <SampleDetails {...sample} />;
}
