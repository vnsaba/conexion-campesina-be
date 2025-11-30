import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { AuthServiceService } from './auth-service.service';
import { UpdateClientStatus } from './dto/update-client-status';
import { ValidRoles } from '../generated/prisma';
import { JwtService } from '@nestjs/jwt';
import { UpdateClienInfo } from './dto/update-client-info.dto';

// Mock user repo (Prisma Client)
const mockUserRepo = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

// Mock data
const mockClientUser = {
  id: 'client-uuid-123',
  fullName: 'Client example',
  email: 'client@example.com',
  role: ValidRoles.CLIENT,
  status: 'ACTIVE',
  password: 'hashedpassword123',
  address: '',
};

const mockProducerUser = {
  id: 'producer-uuid-456',
  email: 'producer@example.com',
  fullName: 'Producer example',
  role: ValidRoles.PRODUCER,
  status: 'ACTIVE',
  password: 'hashedpassword456',
  address: '',
};

const mockAdminUser = {
  id: 'admin-uuid-789',
  fullName: 'Admin example',
  email: 'admin@example.com',
  role: ValidRoles.ADMIN,
  status: 'ACTIVE',
  password: 'hashedpassword789',
  address: '',
};

const mockClientDeleted = {
  id: 'client-uuid-495',
  fullName: 'Client example',
  email: 'sbsmrth@gmail.com',
  role: ValidRoles.CLIENT,
  status: 'DELETED',
  password: 'hashedpassword789',
  address: '',
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
      newStatus: 'INACTIVE',
    };

    const updatedUser = { ...mockClientUser, status: dto.newStatus };

    mockUserRepo.findUnique.mockResolvedValue(mockClientUser);
    mockUserRepo.update.mockResolvedValue(updatedUser);

    const result = await service.updateClientStatus(dto);

    expect(mockUserRepo.findUnique).toHaveBeenCalledWith({
      where: { id: dto.clientId },
    });

    expect(mockUserRepo.update).toHaveBeenCalledWith({
      where: { id: dto.clientId },
      data: { status: dto.newStatus },
    });

    expect(result).toEqual({
      id: 'client-uuid-123',
      fullName: 'Client example',
      email: 'client@example.com',
      role: ValidRoles.CLIENT,
      status: 'INACTIVE',
      address: '',
    });

    // @ts-expect-error Password is already excluded in the service method
    expect(result.password).toBeUndefined();
  });

  it('should successfully update a PRODUCER status', async () => {
    const dto: UpdateClientStatus = {
      clientId: 'producer-uuid-456',
      newStatus: 'INACTIVE',
    };

    const updatedUser = { ...mockProducerUser, status: dto.newStatus };

    mockUserRepo.findUnique.mockResolvedValue(mockProducerUser);
    mockUserRepo.update.mockResolvedValue(updatedUser);

    const result = await service.updateClientStatus(dto);

    expect(mockUserRepo.findUnique).toHaveBeenCalledWith({
      where: { id: dto.clientId },
    });
    expect(mockUserRepo.update).toHaveBeenCalledWith({
      where: { id: dto.clientId },
      data: { status: dto.newStatus },
    });

    expect(result!.status).toBe('INACTIVE');
    expect(result!.role).toBe(ValidRoles.PRODUCER);

    // @ts-expect-error Password is already excluded in the service method
    expect(result!.password).toBeUndefined();
  });

  it('should throw RpcException (NOT_FOUND) if user is not found', async () => {
    const dto: UpdateClientStatus = {
      clientId: 'non-existent-id',
      newStatus: 'ACTIVE',
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
      newStatus: 'INACTIVE',
    };

    mockUserRepo.findUnique.mockResolvedValue(mockAdminUser);

    await expect(service.updateClientStatus(dto)).rejects.toThrow(RpcException);

    await expect(service.updateClientStatus(dto)).rejects.toThrow(
      `Cannot update status: User '${dto.clientId}' is not a 'CLIENT' or 'PRODUCER'`,
    );

    expect(mockUserRepo.update).not.toHaveBeenCalled();
    expect(handleErrorSpy).toHaveBeenCalledWith(expect.any(RpcException));
  });

  it('should throw RpcException (BAD_REQUEST) if user status is DELETED', async () => {
    const dto: UpdateClientStatus = {
      clientId: 'client-uuid-495',
      newStatus: 'ACTIVE',
    };

    mockUserRepo.findUnique.mockResolvedValue(mockClientDeleted);

    await expect(service.updateClientStatus(dto)).rejects.toThrow(RpcException);

    await expect(service.updateClientStatus(dto)).rejects.toThrow(
      'Cannot modify delete user',
    );

    expect(mockUserRepo.update).not.toHaveBeenCalled();
    expect(handleErrorSpy).toHaveBeenCalledWith(expect.any(RpcException));
  });

  it('should call handleError on a general database error', async () => {
    const dto: UpdateClientStatus = {
      clientId: 'client-uuid-123',
      newStatus: 'INACTIVE',
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

describe('updateUserProfile', () => {
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

  it('should successfully update fullName and address', async () => {
    const dto: UpdateClienInfo = {
      clientId: 'client-uuid-123',
      fullName: 'New Name',
      address: 'New Address',
    };

    const updatedUser = {
      ...mockClientUser,
      fullName: dto.fullName,
      address: dto.address,
    };

    mockUserRepo.findUnique.mockResolvedValue(mockClientUser);
    mockUserRepo.update.mockResolvedValue(updatedUser);

    const result = await service.updateUserProfile(dto);

    expect(mockUserRepo.findUnique).toHaveBeenCalledWith({
      where: { id: dto.clientId },
    });

    expect(mockUserRepo.update).toHaveBeenCalledWith({
      where: { id: dto.clientId },
      data: {
        fullName: dto.fullName,
        address: dto.address,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        fullName: 'New Name',
        address: 'New Address',
      }),
    );

    // @ts-expect-error Password is already excluded in the service method
    expect(result.password).toBeUndefined();
  });

  it('should successfully update only fullName and keep existing address', async () => {
    const dto: UpdateClienInfo = {
      clientId: 'client-uuid-123',
      fullName: 'New Name',
    };

    const updatedUser = {
      ...mockClientUser,
      fullName: dto.fullName,
      address: mockClientUser.address,
    };

    mockUserRepo.findUnique.mockResolvedValue(mockClientUser);
    mockUserRepo.update.mockResolvedValue(updatedUser);

    await service.updateUserProfile(dto);

    expect(mockUserRepo.update).toHaveBeenCalledWith({
      where: { id: dto.clientId },
      data: {
        fullName: dto.fullName,
        address: mockClientUser.address,
      },
    });
  });

  it('should successfully update only address and keep existing fullName', async () => {
    const dto: UpdateClienInfo = {
      clientId: 'client-uuid-123',
      address: 'New Address',
    };

    const updatedUser = {
      ...mockClientUser,
      address: dto.address,
      fullName: mockClientUser.fullName,
    };

    mockUserRepo.findUnique.mockResolvedValue(mockClientUser);
    mockUserRepo.update.mockResolvedValue(updatedUser);

    await service.updateUserProfile(dto);

    expect(mockUserRepo.update).toHaveBeenCalledWith({
      where: { id: dto.clientId },
      data: {
        fullName: mockClientUser.fullName,
        address: dto.address,
      },
    });
  });

  it('should throw RpcException (NOT_FOUND) if user does not exist', async () => {
    const dto: UpdateClienInfo = {
      clientId: 'non-existent-id',
      fullName: 'Name',
    };

    mockUserRepo.findUnique.mockResolvedValue(null);

    await expect(service.updateUserProfile(dto)).rejects.toThrow(RpcException);

    await expect(service.updateUserProfile(dto)).rejects.toThrow(
      `User with id '${dto.clientId}' not found`,
    );

    expect(mockUserRepo.update).not.toHaveBeenCalled();
  });

  it('should call handleError on database error', async () => {
    const dto: UpdateClienInfo = {
      clientId: 'client-uuid-123',
      fullName: 'New Name',
    };
    const dbError = new Error('Database error');

    mockUserRepo.findUnique.mockRejectedValue(dbError);

    await expect(service.updateUserProfile(dto)).rejects.toThrow(
      'Database error',
    );

    expect(handleErrorSpy).toHaveBeenCalledWith(dbError);
  });
});
