import { Injectable, Logger } from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

/**
 * Message attributes for SQS messages
 */
export interface SQSMessageAttributes {
  [key: string]: string;
}

/**
 * Options for sending a message to SQS
 */
export interface SendMessageOptions {
  /** The SQS queue URL */
  queueUrl: string;
  /** Message body (will be JSON stringified if object) */
  body: Record<string, any> | string;
  /** Optional message attributes for filtering/routing */
  attributes?: SQSMessageAttributes;
  /** Optional delay in seconds (0-900) */
  delaySeconds?: number;
}

/**
 * SQSService
 *
 * Centralized service for sending messages to AWS SQS queues.
 * Provides a generic sendMessage function that can be used by any module.
 *
 * Usage pattern:
 * 1. Perform database operations (within transaction)
 * 2. After transaction commits, send message to SQS (fire-and-forget)
 *
 * This ensures database consistency - SQS failures don't rollback DB changes.
 *
 * @example
 * // Send a message to a queue
 * await this.sqsService.sendMessage({
 *   queueUrl: process.env.MY_QUEUE_URL,
 *   body: { eventType: 'user_created', userId: '123' },
 *   attributes: { eventType: 'user_created' },
 * });
 */
@Injectable()
export class SQSService {
  private readonly logger = new Logger(SQSService.name);
  private sqsClient: SQSClient;

  constructor() {
    const isDevelopment = process.env.NODE_ENV === 'development';

    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(isDevelopment && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      }),
    });

    this.logger.log(
      `Initialized with ${isDevelopment ? 'local credentials' : 'IAM role'}`,
    );
  }

  /**
   * Send a message to an SQS queue
   *
   * @param options - Message options (queueUrl, body, attributes, delaySeconds)
   * @returns Message ID from SQS, or null if send failed/skipped
   *
   * @example
   * const messageId = await this.sqsService.sendMessage({
   *   queueUrl: process.env.TRANSITION_EVENTS_QUEUE_URL,
   *   body: {
   *     eventId: event.id,
   *     contactId: event.contactId,
   *     eventType: 'lead_created',
   *   },
   *   attributes: {
   *     eventType: 'lead_created',
   *     contactId: event.contactId,
   *   },
   * });
   */
  async sendMessage(options: SendMessageOptions): Promise<string | null> {
    const { queueUrl, body, attributes, delaySeconds } = options;

    if (!queueUrl) {
      this.logger.warn('SQS queue URL not provided, skipping message send');
      return null;
    }

    try {
      // Convert body to string if it's an object
      const messageBody =
        typeof body === 'string' ? body : JSON.stringify(body);

      // Build message attributes
      const messageAttributes = attributes
        ? Object.entries(attributes).reduce(
            (acc, [key, value]) => ({
              ...acc,
              [key]: {
                DataType: 'String',
                StringValue: value,
              },
            }),
            {},
          )
        : undefined;

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: messageBody,
        ...(messageAttributes && { MessageAttributes: messageAttributes }),
        ...(delaySeconds !== undefined && { DelaySeconds: delaySeconds }),
      });

      const result = await this.sqsClient.send(command);

      this.logger.log(`Sent message to SQS: ${result.MessageId}`);

      return result.MessageId || null;
    } catch (error) {
      // Log error but don't throw - SQS send is fire-and-forget
      this.logger.error(
        `Failed to send message to SQS: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }
}