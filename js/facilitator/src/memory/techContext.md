# Teams Agent Technical Context

## Technology Stack

### Core Technologies
- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Microsoft Teams SDK (@microsoft/spark.*)
- **Package Manager**: npm

### Key Dependencies
- `@microsoft/spark.api` - Teams API interface
- `@microsoft/spark.apps` - Teams app framework
- `@microsoft/spark.cards` - UI card components
- `@microsoft/spark.dev` - Development tools
- `@microsoft/spark.graph` - Microsoft Graph integration

### Development Dependencies
- `typescript` - Static typing and compilation
- `ts-node` - TypeScript execution environment
- `nodemon` - Development server with hot reload
- `dotenv` - Environment variable management
- `tsup` - TypeScript bundler
- `rimraf` - Cross-platform file deletion

## Development Setup

### Project Structure
```
src/
├── agent/              # Core agent functionality
│   ├── core.ts        # Main agent class
│   └── router.ts      # Message routing
├── capabilities/       # Capability implementations
│   ├── base.ts        # Base capability interface
│   ├── manager.ts     # Capability management
│   └── summarization/ # Sample capability
├── memory/            # Project documentation
└── index.ts          # Application entry point
```

### Environment Configuration
- Local development uses `.env` file
- Teams configuration in `teamsapp.local.yml`
- Production config in `teamsapp.yml`

### Build Process
1. TypeScript compilation
2. Bundle generation with tsup
3. Output to `dist/` directory

### Development Workflow
1. Start with `npm run dev`
2. Hot reload enabled
3. Teams Toolkit integration
4. Local testing support

## Technical Constraints

### Teams Platform
- Message size limits
- API rate limiting
- Authentication requirements
- Teams-specific message formats

### Capability Implementation
- Must implement Capability interface
- Keyword-based message routing
- Asynchronous message handling
- Response format requirements

## Integration Points

### Teams Integration
- Authentication via Teams
- Message handling
- User context
- Teams UI components

### Future Integration Considerations
1. External APIs for capabilities
2. Database integration
3. State management
4. Caching layer
5. Monitoring and logging

## Development Guidelines

### Code Organization
- One capability per directory
- Shared interfaces in base files
- Clear separation of concerns
- Modular capability design

### TypeScript Usage
- Strict type checking
- Interface-driven development
- Proper type exports
- Documentation comments

### Testing Strategy
- Unit tests for capabilities
- Integration tests for routing
- Teams Toolkit test tools
- Mocked Teams context

### Deployment Considerations
- Environment configuration
- Teams app packaging
- Version management
- Rollback procedures
