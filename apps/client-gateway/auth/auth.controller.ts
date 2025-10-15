import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { RegisterUserDto } from 'apps/auth-service/src/dto/register-user.dto';
import { catchError } from 'rxjs';

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
}
