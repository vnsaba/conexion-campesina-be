import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';
import { RegisterUserDto } from './dto/register-user.dto';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthServiceService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('AuthService');

  async onModuleInit() {
    await this.$connect();
  }

  async registerUser(registerUserDto: RegisterUserDto) {
    const { email, password, fullName, role } = registerUserDto;

    try {
      const user = await this.user.findUnique({
        where: { email },
      });

      if (user) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'Email or password is incorrect',
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await this.user.create({
        data: {
          email,
          password: hashedPassword,
          fullName,
          role,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: __, ...newUserData } = newUser;

      return newUserData;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: any) {
    this.logger.error('Error occurred', error);

    if (error instanceof RpcException) {
      throw error;
    }

    throw new RpcException({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Unknown error occurred',
    });
  }
}
