import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Get all users with pagination
   */
  async findAll(limit = 100, offset = 0): Promise<{
    users: User[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const [users, total] = await this.userRepository.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      users,
      total,
      limit,
      offset,
    };
  }
}
