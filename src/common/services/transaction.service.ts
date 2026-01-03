import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Centralized service for database transaction management.
 *
 * Use this service when you need to execute multiple database operations
 * that must succeed or fail together (atomicity).
 *
 * @example
 * // Simple usage
 * await this.transactionService.runInTransaction(async (manager) => {
 *   await manager.save(User, user);
 *   await manager.update(Applicant, id, { userId: user.id });
 * });
 *
 * @example
 * // With return value
 * const result = await this.transactionService.runInTransaction(async (manager) => {
 *   const user = await manager.save(User, userData);
 *   await manager.save(Profile, { userId: user.id });
 *   return user;
 * });
 */
@Injectable()
export class TransactionService {
  constructor(private dataSource: DataSource) {}

  /**
   * Execute multiple database operations within a single transaction.
   *
   * All operations performed using the provided EntityManager will be
   * automatically committed if successful, or rolled back if any operation fails.
   *
   * IMPORTANT: Always use the provided `manager` parameter for all database
   * operations within the callback. Using repositories directly will bypass
   * the transaction.
   *
   * @param work - Async function containing database operations
   * @returns The result of the work function
   * @throws Re-throws any error after rolling back the transaction
   *
   * @example
   * await this.transactionService.runInTransaction(async (manager) => {
   *   // Use manager.save(), manager.update(), manager.delete()
   *   // NOT this.userRepository.save()
   *   await manager.save(User, user);
   *   await manager.update(Applicant, applicant.id, { userId: user.id });
   * });
   */
  async runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      return work(manager);
    });
  }

  /**
   * Get the DataSource for advanced use cases.
   * Prefer using runInTransaction() for most cases.
   */
  getDataSource(): DataSource {
    return this.dataSource;
  }
}
