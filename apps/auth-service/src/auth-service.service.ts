import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';
import { RegisterUserDto } from './dto/register-user.dto';
import { RpcException, Payload } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { stat } from 'fs';

@Injectable()
export class AuthServiceService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('AuthService');

  constructor(private readonly jwtService: JwtService) {
    super();
  }

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

  async signJWT(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  async loginUser(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto

    try {
      const user = await this.user.findUnique({ where: { email } })

      if (!user) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'Email or password not valid',
        })
      }

      const isPasswordValid = await bcrypt.compare(password, user.password)

      if (!isPasswordValid) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'Email or password not valid',
        })
      }

      const { password: __, ...userData } = user;

      return {
        user: userData,
        token: await this.signJWT(userData)
      };

    } catch (error) {
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message,
      })
    }
  }

  async verifyToken(token: string) {
    try {
      console.log(token);
      const {sub, iat, ...user} = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
      console.log(user);
      return {
        user: user,
        token: token
      }
    } catch (error) {
      throw new RpcException({
        status: HttpStatus.UNAUTHORIZED,
        message: 'Invalid token',
      })
    }
  }
}
