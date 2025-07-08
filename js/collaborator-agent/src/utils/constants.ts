// Application configuration constants

/**
 * Configuration for mock data usage
 * 
 * SETUP INSTRUCTIONS:
 * 1. To enable mock mode: Set USE_MOCK_DATA = true
 * 2. To disable mock mode: Set USE_MOCK_DATA = false
 * 3. Restart the application after changing these values
 * 
 * When USE_MOCK_DATA is true:
 * - All conversations will use the mock data instead of real Teams conversations
 * - The AI can summarize and query the mock conversation history
 * - Perfect for testing and development without real conversation data
 * 
 * The mock data includes sample conversations about:
 * - Recent project discussions (dashboard development)
 * - Microsoft Teams features and capabilities
 * - Azure cost optimization strategies
 */
export const USE_MOCK_DATA = false; // Change to true to enable mock mode
export const DEFAULT_MOCK_CONVERSATION = 'mock-conversation';

/**
 * Other application constants
 */
export const APP_NAME = 'Teams Collaborator Bot';
export const VERSION = '1.0.0';
