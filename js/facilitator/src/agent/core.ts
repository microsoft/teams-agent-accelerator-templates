import { MessageActivity } from '@microsoft/spark.api';
import { App } from '@microsoft/spark.apps';
import { DevtoolsPlugin } from '@microsoft/spark.dev';
import { CapabilityManager } from '../capabilities/manager';
import { MessageRouter } from './router';

export class Agent {
  private app: App;
  private capabilityManager: CapabilityManager;
  private messageRouter: MessageRouter;

  constructor() {
    this.app = new App({
      plugins: [new DevtoolsPlugin()],
    });

    this.capabilityManager = new CapabilityManager();
    this.messageRouter = new MessageRouter(this.capabilityManager);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.app.on('message', async ({ log, signin, isSignedIn, message, send }) => {
      if (!isSignedIn) {
        await signin();
        return;
      }

      log.info('Processing message');
      
      // Route message to capabilities
      const responses = await this.messageRouter.routeMessage(message as MessageActivity);
      
      // Send all responses
      for (const response of responses) {
        await send(response);
      }
    });

    this.app.event('signin', async ({ send, api }) => {
      const me = await api.user.me.get();
      await send(new MessageActivity(`Hello ${me.displayName}! I'm your AI assistant. How can I help you today?`));
    });
  }

  /**
   * Start the agent
   */
  async start(port: number): Promise<void> {
    await this.app.start(port);
  }

  /**
   * Register a new capability
   */
  registerCapability(capability: any): void {
    this.capabilityManager.registerCapability(capability);
  }
}
