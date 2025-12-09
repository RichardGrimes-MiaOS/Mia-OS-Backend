import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../users/entities/user.entity';
import * as readline from 'readline';

/**
 * Script to create the first super admin user
 *
 * Usage:
 *   npm run create-super-admin
 *
 * This script will:
 * 1. Prompt for super admin details (email, name, phone)
 * 2. Create the user in Cognito with a temporary password
 * 3. Save the user to the database with SUPER_ADMIN role
 * 4. Display the temporary password (must be changed on first login)
 */
async function bootstrap() {
  console.log('\n=== Create Super Admin User ===\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

  try {
    // Collect user input
    // const email = await question('Email: ');
    // if (!email || !email.includes('@')) {
    //   throw new Error('Valid email is required');
    // }

    // const firstName = await question('First Name: ');
    // if (!firstName) {
    //   throw new Error('First name is required');
    // }

    // const lastName = await question('Last Name: ');
    // if (!lastName) {
    //   throw new Error('Last name is required');
    // }

    // const phone = await question('Phone (optional, format: +1234567890): ');
    const email: string = 'haxanbunny33@gmail.com';
    const firstName: string = 'Muhammad';
    const lastName: string = 'Hassan';
    const phone: string = '+1234567890';

    console.log('\nCreating super admin...');

    // Create the super admin user
    const result = await authService.createUser(
      email,
      firstName,
      lastName,
      phone || undefined,
      UserRole.SUPER_ADMIN,
      undefined, // No creator for the first super admin
    );

    console.log('\n✅ Super admin created successfully!\n');
    console.log('User Details:');
    console.log(`  ID: ${result.user.id}`);
    console.log(`  Email: ${result.user.email}`);
    console.log(`  Name: ${result.user.firstName} ${result.user.lastName}`);
    console.log(`  Role: ${result.user.role}`);
    console.log(`  Status: ${result.user.status}`);
    console.log(`\n🔑 Temporary Password: ${result.temporaryPassword}`);
    console.log('\n⚠️  IMPORTANT: Save this password securely!');
    console.log('   The user must change this password on first login.\n');
  } catch (error: any) {
    console.error('\n❌ Error creating super admin:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await app.close();
  }
}

bootstrap();
