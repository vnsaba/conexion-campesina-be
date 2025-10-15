import { Controller } from '@nestjs/common';
import { AuthServiceService } from './auth-service.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RegisterUserDto } from './dto/register-user.dto';

@Controller()
export class AuthServiceController {
  constructor(private readonly authServiceService: AuthServiceService) {}

  @MessagePattern('auth.register.user')
  registerUser(@Payload() registerUserDto: RegisterUserDto) {
    return this.authServiceService.registerUser(registerUserDto);
  }
}
