import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CadenceLog } from './entities/cadence-log.entity';
import { SSMService } from './services/ssm.service';

@Injectable()
export class CadenceService {
  constructor(
    @InjectRepository(CadenceLog)
    private readonly cadenceLogRepository: Repository<CadenceLog>,
    private readonly ssmService: SSMService,
  ) {}

  async getTodayLog(userId: string): Promise<CadenceLog | null> {
    // Get current global cadence day from SSM
    const currentCadenceDay = await this.ssmService.getCadenceDay();

    // Get today's date in YYYY-MM-DD format (assuming server runs in user's timezone or UTC)
    const today = new Date().toISOString().split('T')[0];

    // Find today's log for this user matching the current cadence day
    const todayLog = await this.cadenceLogRepository.findOne({
      where: {
        userId,
        logDate: today,
        cadenceDayNumber: currentCadenceDay,
      },
      relations: ['user'],
    });

    return todayLog;
  }

  async getHistory(userId: string): Promise<CadenceLog[]> {
    const history = await this.cadenceLogRepository.find({
      where: { userId },
      order: { logDate: 'DESC' },
    });

    return history;
  }
}
