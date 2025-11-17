import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { LoginUserDto } from 'apps/auth-service/src/dto/login-user.dto';
import { RegisterUserDto } from 'apps/auth-service/src/dto/register-user.dto';
import { catchError } from 'rxjs';
import { AuthGuard } from './guards/auth.guards';
import { RoleProtected, Token, User } from './guards/decorators';
import { CurrentUser } from './guards/interface/current-user.interface';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UpdateClientStatus } from './dto/update-client-status';
import { ValidRoles } from '../auth/enum/valid-roles.enum';
import { UserRoleGuard } from './guards/user-role.guard';

const NATS_SERVICE_KEY = process.env.NATS_SERVICE_KEY;

@ApiBearerAuth('bearer')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(NATS_SERVICE_KEY)
    private readonly natsClient: ClientProxy,
  ) {}

  /**
   * Handles user registration.
   * Sends user data to the NATS auth service for account creation.
   */
  @Post('register')
  registerUser(@Body() registerUserDto: RegisterUserDto) {
    return this.natsClient.send('auth.register.user', registerUserDto).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Handles user login.
   * Sends credentials to the NATS auth service and returns authentication data.
   */
  @Post('login')
  loginUser(@Body() loginUserDto: LoginUserDto) {
    return this.natsClient.send('auth.login.user', loginUserDto).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Verifies a user's JWT token.
   * Requires authentication via AuthGuard and returns user data with the token.
   */
  @UseGuards(AuthGuard, UserRoleGuard)
  @Get('verify')
  verifyToken(@User() user: CurrentUser, @Token() token: string) {
    return { user, token };
  }

  /**
   * Retrieve user information by id.
   */
  @Get('userinfo/:id')
  @UseGuards(AuthGuard)
  getUserById(@Param('id') id: string) {
    return this.natsClient.send('auth.get.user', id).pipe(
      catchError((error) => {
        throw new RpcException(error);
      }),
    );
  }

  /**
   * Update the status of a specific client (CLIENT) OR (PRODUCER).
   */
  @RoleProtected(ValidRoles.ADMIN)
  @Post('update-client-status/:clientId')
  @UseGuards(AuthGuard, UserRoleGuard)
  updateClientStatus(
    @Param('clientId') clientId: string,
    @Body() body: UpdateClientStatus,
  ) {
    try {
      return this.natsClient.send('auth.update.client.status', {
        clientId,
        newStatus: body.newStatus,
      });
    } catch (error) {
      throw new RpcException(error);
    }
  }

  /**
   * Get regular users
   */
  @RoleProtected(ValidRoles.ADMIN)
  @Get('users')
  @UseGuards(AuthGuard, UserRoleGuard)
  getUsers() {
    try {
      return this.natsClient.send('auth.get.users', {});
    } catch (error) {
      throw new RpcException(error);
    }
  }
}
