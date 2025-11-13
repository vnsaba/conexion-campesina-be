import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { AuthServiceService } from './auth-service.service';
import { UpdateClientStatus } from './dto/update-client-status';
import { ValidRoles } from '../generated/prisma';
import { JwtService } from '@nestjs/jwt';

// Mock user repo (Prisma Client)
const mockUserRepo = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

// Mock data
const mockClientUser = {
  id: 'client-uuid-123',
  email: 'client@example.com',
  role: ValidRoles.CLIENT,
  isActive: true,
  password: 'hashedpassword123',
};

const mockProducerUser = {
  id: 'producer-uuid-456',
  email: 'producer@example.com',
  role: ValidRoles.PRODUCER,
  isActive: true,
  password: 'hashedpassword456',
};

const mockAdminUser = {
  id: 'admin-uuid-789',
  email: 'admin@example.com',
  role: ValidRoles.ADMIN,
  isActive: true,
  password: 'hashedpassword789',
};

describe('AuthServiceService (updateClientStatus)', () => {
  let service: AuthServiceService;
  let handleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthServiceService,
        {
          provide: JwtService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AuthServiceService>(AuthServiceService);

    (service as any).user = mockUserRepo;

    handleErrorSpy = jest
      .spyOn(service as any, 'handleError')
      .mockImplementation((error) => {
        throw error;
      });

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should successfully update a CLIENT status', async () => {
    const dto: UpdateClientStatus = {
      clientId: 'client-uuid-123',
      active: false,
    };

    const updatedUser = { ...mockClientUser, isActive: false };

    mockUserRepo.findUnique.mockResolvedValue(mockClientUser);
    mockUserRepo.update.mockResolvedValue(updatedUser);

    const result = await service.updateClientStatus(dto);

    expect(mockUserRepo.findUnique).toHaveBeenCalledWith({
      where: { id: dto.clientId },
    });

    expect(mockUserRepo.update).toHaveBeenCalledWith({
      where: { id: dto.clientId },
      data: { isActive: dto.active },
    });

    expect(result).toEqual({
      id: 'client-uuid-123',
      email: 'client@example.com',
      role: ValidRoles.CLIENT,
      isActive: false,
    });

    // @ts-expect-error Password is already excluded in the service method
    expect(result.password).toBeUndefined();
  });

  it('should successfully update a PRODUCER status', async () => {
    const dto: UpdateClientStatus = {
      clientId: 'producer-uuid-456',
      active: false,
    };

    const updatedUser = { ...mockProducerUser, isActive: false };

    mockUserRepo.findUnique.mockResolvedValue(mockProducerUser);
    mockUserRepo.update.mockResolvedValue(updatedUser);

    const result = await service.updateClientStatus(dto);

    expect(mockUserRepo.findUnique).toHaveBeenCalledWith({
      where: { id: dto.clientId },
    });
    expect(mockUserRepo.update).toHaveBeenCalledWith({
      where: { id: dto.clientId },
      data: { isActive: dto.active },
    });

    expect(result!.isActive).toBe(false);
    expect(result!.role).toBe(ValidRoles.PRODUCER);

    // @ts-expect-error Password is already excluded in the service method
    expect(result!.password).toBeUndefined();
  });

  it('should throw RpcException (NOT_FOUND) if user is not found', async () => {
    const dto: UpdateClientStatus = {
      clientId: 'non-existent-id',
      active: true,
    };

    mockUserRepo.findUnique.mockResolvedValue(null);

    await expect(service.updateClientStatus(dto)).rejects.toThrow(RpcException);

    await expect(service.updateClientStatus(dto)).rejects.toThrow(
      `User with id '${dto.clientId}' not found`,
    );

    expect(mockUserRepo.update).not.toHaveBeenCalled();
    expect(handleErrorSpy).toHaveBeenCalledWith(expect.any(RpcException));
  });

  it('should throw RpcException (FORBIDDEN) if user role is invalid', async () => {
    const dto: UpdateClientStatus = {
      clientId: 'admin-uuid-789',
      active: false,
    };

    mockUserRepo.findUnique.mockResolvedValue(mockAdminUser);

    await expect(service.updateClientStatus(dto)).rejects.toThrow(RpcException);

    await expect(service.updateClientStatus(dto)).rejects.toThrow(
      `Cannot update status: User '${dto.clientId}' is not a 'CLIENT' or 'PRODUCER'`,
    );

    expect(mockUserRepo.update).not.toHaveBeenCalled();
    expect(handleErrorSpy).toHaveBeenCalledWith(expect.any(RpcException));
  });

  it('should call handleError on a general database error', async () => {
    const dto: UpdateClientStatus = {
      clientId: 'client-uuid-123',
      active: false,
    };
    const dbError = new Error('Database connection lost');

    mockUserRepo.findUnique.mockRejectedValue(dbError);

    await expect(service.updateClientStatus(dto)).rejects.toThrow(
      'Database connection lost',
    );

    expect(mockUserRepo.update).not.toHaveBeenCalled();
    expect(handleErrorSpy).toHaveBeenCalledWith(dbError);
  });
});
