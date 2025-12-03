import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    const authority = configService.get<string>('AWS_COGNITO_AUTHORITY');
    const region = configService.get<string>('AWS_REGION');
    const userPoolId = configService.get<string>('AWS_COGNITO_USER_POOL_ID');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience: configService.get<string>('AWS_COGNITO_CLIENT_ID'),
      issuer: authority || `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
      }),
    });
  }

  async validate(payload: any): Promise<User> {
    const cognitoSub = payload.sub;

    if (!cognitoSub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Fetch user from database using cognitoSub
    const user = await this.userRepository.findOne({
      where: { cognitoSub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found in database');
    }

    // Update last login
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    return user;
  }
}