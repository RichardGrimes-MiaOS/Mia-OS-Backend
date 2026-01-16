import { Module, Global } from '@nestjs/common';
import { TransactionService } from './services/transaction.service';
import { SQSService } from './services/sqs.service';

/**
 * Global module for common utilities and services.
 * Marked as @Global so services can be injected anywhere without explicit imports.
 *
 * Services:
 * - TransactionService: Database transaction management
 * - SQSService: AWS SQS message sending
 */
@Global()
@Module({
  providers: [TransactionService, SQSService],
  exports: [TransactionService, SQSService],
})
export class CommonModule {}
