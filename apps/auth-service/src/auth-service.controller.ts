import { Controller } from '@nestjs/common';
import { AuthServiceService } from './auth-service.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateClientStatus } from './dto/update-client-status';
import { UpdateClienInfo } from './dto/update-client-info.dto';

@Controller()
export class AuthServiceController {
  constructor(private readonly authServiceService: AuthServiceService) {}

  @MessagePattern('auth.register.user')
  registerUser(@Payload() registerUserDto: RegisterUserDto) {
    return this.authServiceService.registerUser(registerUserDto);
  }

  @MessagePattern('auth.login.user')
  loginUser(@Payload() loginUserDto: LoginUserDto) {
    return this.authServiceService.loginUser(loginUserDto);
  }

  @MessagePattern('auth.verify.token')
  verifyToken(@Payload() token: string) {
    return this.authServiceService.verifyToken(token);
  }

  @MessagePattern('auth.get.user')
  getUser(@Payload() userId: string) {
    return this.authServiceService.getByUser(userId);
  }

  @MessagePattern('auth.get.users')
  getUsers() {
    return this.authServiceService.getUsers();
  }

  @MessagePattern('auth.update.client.status')
  updateClientStatus(@Payload() updateClientStatusDto: UpdateClientStatus) {
    const { clientId, newStatus } = updateClientStatusDto;

    return this.authServiceService.updateClientStatus({ clientId, newStatus });
  }

  @MessagePattern('auth.update.client.info')
  updateClientInfo(@Payload() updateClientInfoDto: UpdateClienInfo) {
    return this.authServiceService.updateUserProfile(updateClientInfoDto);
  }
}
