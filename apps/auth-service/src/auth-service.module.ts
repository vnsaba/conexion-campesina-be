import { Module } from '@nestjs/common';
import { AuthServiceController } from './auth-service.controller';
import { AuthServiceService } from './auth-service.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [],
      inject: [],
      useFactory: () => ({
        global: true,
        secret: process.env.AUTH_MS_JWT_SECRET,
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [AuthServiceController],
  providers: [AuthServiceService],
  exports: [JwtModule],
})
export class AuthServiceModule {}
