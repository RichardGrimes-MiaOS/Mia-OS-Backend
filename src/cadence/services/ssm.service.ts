import { Injectable } from '@nestjs/common';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SSMService {
  private ssmClient: SSMClient;
  private environment: string;

  constructor(private configService: ConfigService) {
    this.ssmClient = new SSMClient({
      region: this.configService.get<string>('AWS_REGION') || 'us-east-2',
    });
    this.environment =
      this.configService.get<string>('NODE_ENV') || 'development';
  }

  async getCadenceDay(): Promise<number> {
    // const parameterName = `/mia/${this.environment}/cycle/cadence_day`;
    const parameterName = `/mia/production/cycle/cadence_day`;

    try {
      const command = new GetParameterCommand({
        Name: parameterName,
      });

      const response = await this.ssmClient.send(command);

      if (!response.Parameter?.Value) {
        throw new Error(
          `SSM parameter ${parameterName} not found or has no value`,
        );
      }

      const cadenceDay = parseInt(response.Parameter.Value, 10);

      if (isNaN(cadenceDay) || cadenceDay < 1 || cadenceDay > 10) {
        throw new Error(
          `Invalid cadence day value: ${response.Parameter.Value}`,
        );
      }

      return cadenceDay;
    } catch (error) {
      console.error(
        `[SSMService] Error fetching cadence day from ${parameterName}:`,
        error,
      );
      throw error;
    }
  }

  async getCycleId(): Promise<string> {
    // const parameterName = `/mia/${this.environment}/cycle/cycle_id`;
    const parameterName = `/mia/production/cycle/cycle_id`;

    try {
      const command = new GetParameterCommand({
        Name: parameterName,
      });

      const response = await this.ssmClient.send(command);

      if (!response.Parameter?.Value) {
        throw new Error(
          `SSM parameter ${parameterName} not found or has no value`,
        );
      }

      return response.Parameter.Value;
    } catch (error) {
      console.error(
        `[SSMService] Error fetching cycle ID from ${parameterName}:`,
        error,
      );
      throw error;
    }
  }
}
