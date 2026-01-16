import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Health check endpoint (Public)',
    description:
      'Returns server health status and timestamp. This endpoint is public and does not require authentication.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Server is healthy - returns { status: "ok", timestamp: ISO8601 }',
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
