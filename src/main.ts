import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    process.env.CORS_ORIGIN,
    'http://localhost:3000', // For local development
  ];

  // Enable CORS
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('MIA CRM API')
    .setDescription('The MIA CRM Backend API documentation')
    .setVersion('1.0')
    .addBearerAuth() // Add JWT authentication support
    .addTag('health', 'Health check endpoint')
    .addTag('applicants', 'Applicant management (pre-signup)')
    .addTag('auth', 'Authentication & authorization (login, tokens, password management, user creation)')
    .addTag('users', 'User management (list users, agent profiles)')
    .addTag('onboarding', 'Agent onboarding (licensing, exam, E&O insurance, fast-track intake, affiliate, admin activation)')
    .addTag('contacts', 'CRM contact management (create, update, delete, filter, pipeline stages)')
    .addTag('tasks', 'Task management (create, update, delete, filter, overdue tracking)')
    .addTag('cadence', 'Cadence tracking (rhythm state, daily logs, history, density-based pattern analysis)')
    .addTag('flowbar', 'Best Next Action (BNA) recommendations (personalized guidance based on user state)')
    .addTag('daily-plan', 'Daily plan progress (required actions, completed actions, progress percentage)')
    .addTag('analytics', 'Event tracking & analytics (user events, activity tracking, admin metrics)')
    .addTag('affiliates', 'Affiliate management (profile CRUD, photo upload, visit tracking, public lookup)')
    .addTag('admin', 'Admin operations')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
  });
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();
