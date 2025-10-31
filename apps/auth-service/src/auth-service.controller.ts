import { Controller } from '@nestjs/common';
import { AuthServiceService } from './auth-service.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

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
}
