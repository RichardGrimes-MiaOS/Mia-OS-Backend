import { Module, Global } from '@nestjs/common';
import { TransactionService } from './services/transaction.service';

/**
 * Global module for common utilities and services.
 * Marked as @Global so services can be injected anywhere without explicit imports.
 */
@Global()
@Module({
  providers: [TransactionService],
  exports: [TransactionService],
})
export class CommonModule {}
