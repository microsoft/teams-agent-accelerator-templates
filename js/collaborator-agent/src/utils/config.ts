// Configuration for AI models used by different agents
export interface ModelConfig {
  model: string;
  apiKey: string;
  endpoint: string;
  apiVersion: string;
}

// Model configurations for different agents
export const AI_MODELS = {
  // Manager Agent - Uses lighter, faster model for routing decisions
  MANAGER: {
    model: 'gpt-4o-mini',
    apiKey: process.env.AOAI_API_KEY!,
    endpoint: process.env.AOAI_ENDPOINT!,
    apiVersion: '2025-04-01-preview',
  } as ModelConfig,

  // Summarizer Agent - Uses more capable model for complex analysis
  SUMMARIZER: {
    model: process.env.AOAI_MODEL || 'gpt-4o',
    apiKey: process.env.AOAI_API_KEY!,
    endpoint: process.env.AOAI_ENDPOINT!,
    apiVersion: '2025-04-01-preview',
  } as ModelConfig,

  // Action Items Agent - Uses capable model for analysis and task management
  ACTION_ITEMS: {
    model: process.env.AOAI_MODEL || 'gpt-4o',
    apiKey: process.env.AOAI_API_KEY!,
    endpoint: process.env.AOAI_ENDPOINT!,
    apiVersion: '2025-04-01-preview',
  } as ModelConfig,

  // Search Agent - Uses capable model for semantic search and deep linking
  SEARCH: {
    model: process.env.AOAI_MODEL || 'gpt-4o',
    apiKey: process.env.AOAI_API_KEY!,
    endpoint: process.env.AOAI_ENDPOINT!,
    apiVersion: '2025-04-01-preview',
  } as ModelConfig,

  // Default model configuration (fallback)
  DEFAULT: {
    model: process.env.AOAI_MODEL || 'gpt-4o',
    apiKey: process.env.AOAI_API_KEY!,
    endpoint: process.env.AOAI_ENDPOINT!,
    apiVersion: '2025-04-01-preview',
  } as ModelConfig,
};

// Helper function to get model config for a specific agent
export function getModelConfig(capabilityType: 'manager' | 'summarizer' | 'actionItems' | 'search' | 'default' = 'default'): ModelConfig {
  switch (capabilityType.toLowerCase()) {
    case 'manager':
      return AI_MODELS.MANAGER;
    case 'summarizer':
      return AI_MODELS.SUMMARIZER;
    case 'actionitems':
      return AI_MODELS.ACTION_ITEMS;
    case 'search':
      return AI_MODELS.SEARCH;
    default:
      return AI_MODELS.DEFAULT;
  }
}

// Environment validation
export function validateEnvironment(): void {
  const requiredEnvVars = ['AOAI_API_KEY', 'AOAI_ENDPOINT'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✅ Environment validation passed');
}

// Model configuration logging
export function logModelConfigs(): void {
  console.log('🔧 AI Model Configuration:');
  console.log(`  Manager Agent: ${AI_MODELS.MANAGER.model}`);
  console.log(`  Summarizer Agent: ${AI_MODELS.SUMMARIZER.model}`);
  console.log(`  Action Items Agent: ${AI_MODELS.ACTION_ITEMS.model}`);
  console.log(`  Search Agent: ${AI_MODELS.SEARCH.model}`);
  console.log(`  Default Model: ${AI_MODELS.DEFAULT.model}`);
}
