import { Module, Global } from '@nestjs/common';
import { CognitoService } from './cognito.service';

/**
 * Global module for AWS Cognito operations.
 * Marked as @Global so it can be injected anywhere without explicit imports.
 */
@Global()
@Module({
  providers: [CognitoService],
  exports: [CognitoService],
})
export class CognitoModule {}
