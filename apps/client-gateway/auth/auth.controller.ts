import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { LoginUserDto } from 'apps/auth-service/src/dto/login-user.dto';
import { RegisterUserDto } from 'apps/auth-service/src/dto/register-user.dto';
import { catchError } from 'rxjs';
import { AuthGuard } from './guards/auth.guards';
import { Token, User } from './guards/decorators';
import { CurrentUser } from './guards/interface/current-user.interface';

const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY;

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(NATS_SERVICE_KEY)
    private readonly natsClient: ClientProxy,
  ) {}

  @Post('register')
  registerUser(@Body() registerUserDto: RegisterUserDto) {
    return this.natsClient.send('auth.register.user', registerUserDto).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  @Post('login')
  loginUser(@Body() loginUserDto: LoginUserDto) {
    return this.natsClient.send('auth.login.user', loginUserDto).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  @UseGuards(AuthGuard)
  @Get('verify')
  verifyToken(@User() user: CurrentUser, @Token() token: string) {
    return { user, token };
  }
}
