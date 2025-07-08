// Mock conversation data for testing and debugging

export interface MockMessage {
  role: 'user' | 'assistant';
  content: string;
  name?: string;
  hoursAgo: number;
}

// Single mock conversation with all messages combined chronologically
export const MOCK_MESSAGES: MockMessage[] = [
  // Recent project discussion (past 2 hours)
  { 
    role: 'user', 
    content: 'Hey team, how is the new dashboard project coming along?', 
    name: 'Sarah Johnson',
    hoursAgo: 2 
  },
  { 
    role: 'assistant', 
    content: 'The dashboard project is progressing well! We\'ve completed the user authentication flow and are now working on the data visualization components.', 
    name: 'AI Assistant',
    hoursAgo: 2 
  },
  { 
    role: 'user', 
    content: 'Great! What about the API integration? Any blockers there?', 
    name: 'Mike Chen',
    hoursAgo: 1.8 
  },
  { 
    role: 'assistant', 
    content: 'API integration is mostly done. We had some rate limiting issues with the external service, but we\'ve implemented proper retry logic and caching.', 
    name: 'AI Assistant',
    hoursAgo: 1.7 
  },
  { 
    role: 'user', 
    content: 'Perfect. When do you think we can have a demo ready?', 
    name: 'Sarah Johnson',
    hoursAgo: 1.5 
  },
  { 
    role: 'assistant', 
    content: 'We should have a working demo by tomorrow afternoon. Just need to polish the UI and add some error handling.', 
    name: 'AI Assistant',
    hoursAgo: 1.4 
  },
  
  // Microsoft Teams features discussion (3 days ago)
  { 
    role: 'user', 
    content: 'Did you see the new Microsoft Teams features announced at Build?', 
    name: 'Alex Rodriguez',
    hoursAgo: 72 
  },
  { 
    role: 'assistant', 
    content: 'Yes! The AI-powered meeting summaries look really promising. It could save so much time in our daily standups.', 
    hoursAgo: 71.8 
  },
  { 
    role: 'user', 
    content: 'Totally agree. And the new collaborative canvas feature seems game-changing for brainstorming sessions.', 
    hoursAgo: 71.5 
  },
  { 
    role: 'assistant', 
    content: 'I\'m most excited about the improved integration with Office 365. Being able to edit docs directly in Teams chat will streamline our workflow significantly.', 
    hoursAgo: 71.2 
  },
  { 
    role: 'user', 
    content: 'Have you tried the new PowerBI integration yet?', 
    hoursAgo: 70.8 
  },
  { 
    role: 'assistant', 
    content: 'Not yet, but I heard it makes sharing dashboards much more intuitive. Should definitely test it out for our quarterly reports.', 
    hoursAgo: 70.5 
  },
  
  // Azure cost optimization discussion (1 week ago)
  { 
    role: 'user', 
    content: 'Our Azure costs are getting a bit high this quarter. Any suggestions for optimization?', 
    hoursAgo: 168 
  },
  { 
    role: 'assistant', 
    content: 'I\'d recommend starting with Azure Cost Management + Billing. We can identify unused resources and right-size our VMs.', 
    hoursAgo: 167.8 
  },
  { 
    role: 'user', 
    content: 'Good idea. What about storage costs? We have a lot of blob storage that might not be accessed frequently.', 
    hoursAgo: 167.5 
  },
  { 
    role: 'assistant', 
    content: 'For blob storage, consider implementing lifecycle management policies. Move older data to cool or archive tiers to reduce costs significantly.', 
    hoursAgo: 167.2 
  },
  { 
    role: 'user', 
    content: 'That makes sense. Should we also look into Reserved Instances for our production VMs?', 
    hoursAgo: 166.8 
  },
  { 
    role: 'assistant', 
    content: 'Absolutely! Reserved Instances can save up to 72% compared to pay-as-you-go pricing. Given our predictable workloads, it\'s a no-brainer.', 
    hoursAgo: 166.5 
  },
  { 
    role: 'user', 
    content: 'I\'ll set up a meeting with the finance team to discuss the RI commitments.', 
    hoursAgo: 166.2 
  },
  { 
    role: 'assistant', 
    content: 'Great! Also consider Azure Hybrid Benefit if we have any on-premises Windows Server licenses we can leverage.', 
    hoursAgo: 166 
  },
];

// Helper function to create a mock database
export function createMockDatabase(insertMessageFn: (conversationId: string, role: string, content: string, timestamp: string, name?: string) => void, conversationId: string): void {
  console.log('🎭 Creating mock database with sample conversation...');
  
  // Add all messages to the single conversation
  MOCK_MESSAGES.forEach(msg => {
    const timestamp = new Date(Date.now() - (msg.hoursAgo * 60 * 60 * 1000)).toISOString();
    insertMessageFn(conversationId, msg.role, msg.content, timestamp, msg.name);
  });
  
  console.log(`📝 Created mock conversation with ${MOCK_MESSAGES.length} messages`);
  console.log('✅ Mock database created successfully!');
}

// Function to generate summary text for mock creation
export function getMockSummary(): string {
  return `🎭 **Mock Database Created!**

A single conversation with ${MOCK_MESSAGES.length} sample messages has been created, covering:

📋 **Topics discussed:**
- Recent dashboard project updates (past 2 hours)
- Microsoft Teams features from Build conference (3 days ago)  
- Azure cost optimization strategies (1 week ago)

🔧 **You can now test:**
- Ask me to summarize this conversation
- \`get_recent_messages\` - Show recent messages
- \`get_messages_by_time_range\` - Query by time range
- \`msg.db\` - Debug database contents

💡 **Try asking:** "Can you summarize our recent conversations?"`;
}
