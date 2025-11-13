import {
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient, ValidRoles } from '../generated/prisma';
import { RegisterUserDto } from './dto/register-user.dto';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UpdateClientStatus } from './dto/update-client-status';

@Injectable()
export class AuthServiceService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('AuthService');

  constructor(private readonly jwtService: JwtService) {
    super();
  }

  /**
   * Establishes connection to the Prisma database on module initialization.
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Registers a new user in the system.
   * Validates unique email, hashes password, and stores user in the database.
   *
   * @param registerUserDto - User registration data.
   * @returns The newly created user data (excluding password).
   * @throws {RpcException} If email already exists or an unknown error occurs.
   */
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
          isActive: role !== ValidRoles.PRODUCER,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: __, ...newUserData } = newUser;
      return newUserData;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Generates a signed JWT token for the given payload.
   *
   * @param payload - The JWT payload containing user information.
   * @returns A signed JWT token.
   */
  signJWT(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  /**
   * Authenticates a user with their email and password.
   * Verifies credentials, user status, and returns a signed token.
   *
   * @param loginUserDto - Login credentials (email and password).
   * @returns An object containing the user data and JWT token.
   * @throws {RpcException} If credentials are invalid or user is inactive.
   */
  async loginUser(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    try {
      const user = await this.user.findUnique({ where: { email } });

      if (!user) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'Email or password not valid',
        });
      }

      if (!user.isActive) {
        throw new RpcException({
          status: HttpStatus.UNAUTHORIZED,
          message: 'Inactive user',
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'Email or password not valid',
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: __, ...userData } = user;

      return {
        user: userData,
        token: this.signJWT(userData),
      };
    } catch (error) {
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message,
      });
    }
  }

  /**
   * Verifies and decodes a JWT token.
   * Confirms that the token belongs to an active user.
   *
   * @param token - JWT token to verify.
   * @returns An object containing the verified user and the token.
   * @throws {RpcException} If the token is invalid or the user is inactive.
   */
  async verifyToken(token: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { sub, iat, ...user } = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      const dbUser = await this.user.findFirst({
        where: {
          id: user.id,
          isActive: true,
        },
      });

      if (!dbUser) {
        throw new UnauthorizedException('Inactive user');
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...restUser } = dbUser;

      return {
        user: restUser,
        token,
      };
    } catch (error) {
      this.logger.error(error);

      throw new RpcException({
        status: HttpStatus.UNAUTHORIZED,
        message: 'Invalid token or user',
      });
    }
  }

  /**
   * Retrieves a user by their id.
   * Removes the password field before returning.
   *
   * @param userId - The user's unique identifier to look up.
   * @returns The user object without the password field.
   * @throws {RpcException} If the user is not found or an internal error occurs.
   */
  async getByUser(userId: string) {
    try {
      const user = await this.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `User with id '${userId}' not found`,
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...restUser } = user;

      return restUser;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Updates the status of a specific CLIENT or PRODUCER.
   *
   * @param clientId - The unique identifier of the client whose status is to be updated.
   * @param active - Thew new status to set for the client.
   * @returns The updated user object.
   * @throws {RpcException} If the user is not found, the role is invalid, or an internal error occurs.
   */
  async updateClientStatus(updateClientDto: UpdateClientStatus) {
    const { clientId, active } = updateClientDto;

    try {
      const user = await this.user.findUnique({
        where: { id: clientId },
      });

      if (!user) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `User with id '${clientId}' not found`,
        });
      }

      const validRoles: ValidRoles[] = [ValidRoles.CLIENT, ValidRoles.PRODUCER];

      if (!validRoles.includes(user.role)) {
        throw new RpcException({
          status: HttpStatus.FORBIDDEN,
          message: `Cannot update status: User '${clientId}' is not a 'CLIENT' or 'PRODUCER'`,
        });
      }

      const updatedUser = await this.user.update({
        where: { id: clientId },
        data: { isActive: active },
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...restUser } = updatedUser;

      return restUser;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Handles and logs unexpected errors.
   * Throws an RPC exception with a consistent internal server response.
   *
   * @param error - The error to be handled.
   * @throws {RpcException} Standardized RPC error.
   */
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
