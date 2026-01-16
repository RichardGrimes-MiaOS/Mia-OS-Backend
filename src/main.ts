import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
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
    .addTag('applicants', 'Applicant management (pre-signup)')
    .addTag('auth', 'Authentication & authorization (login, tokens, password management, user creation)')
    .addTag('users', 'User management (list users, agent profiles)')
    .addTag('onboarding', 'Agent onboarding workflows')
    .addTag('contacts', 'CRM contact management (create, update, delete, filter, pipeline stages)')
    .addTag('tasks', 'Task management (create, update, delete, filter, overdue tracking)')
    .addTag('affiliates', 'Affiliate tracking')
    .addTag('admin', 'Admin operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();
