import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { UnitService } from '../src/unit/unit.service';
import { MeasureType } from '../generated/prisma';

describe('UnitService', () => {
  let service: UnitService;

  const mockUnit = {
    id: '507f1f77bcf86cd799439011',
    name: 'Kilogramo',
    symbol: 'kg',
    type: MeasureType.WEIGHT,
    description: 'Unidad de medida de peso en el sistema métrico',
    equivalentValue: 1.0,
    baseUnit: 'Gramo',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createDto = {
    name: 'Kilogramo',
    symbol: 'kg',
    type: MeasureType.WEIGHT,
    description: 'Unidad de medida de peso en el sistema métrico',
    equivalentValue: 1.0,
    baseUnit: 'Gramo',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UnitService],
    }).compile();

    service = module.get<UnitService>(UnitService);

    // Mock prisma models
    Object.defineProperty(service, 'unit', {
      value: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      writable: false,
    });

    Object.defineProperty(service, 'productOffer', {
      value: {
        count: jest.fn(),
      },
      writable: false,
    });

    service.$connect = jest.fn().mockResolvedValue(undefined);
    service.$disconnect = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await service.$disconnect();
    jest.clearAllMocks();
  });

  describe('create - name length boundaries', () => {
    it('should fail when name length is 1 (below minimum)', async () => {
      const dto = { ...createDto, name: 'K' };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockRejectedValue(
        new Error('Name validation failed'),
      );

      await expect(service.create(dto as any)).rejects.toBeInstanceOf(
        RpcException,
      );
    });

    it('should succeed when name length is 2 (minimum boundary)', async () => {
      const dto = { ...createDto, name: 'Kg' };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockResolvedValue({
        ...mockUnit,
        name: 'Kg',
      });

      const result = await service.create(dto as any);
      expect(result.name).toBe('Kg');
    });

    it('should succeed when name length is within boundaries (10)', async () => {
      const dto = { ...createDto, name: 'Kilogramos' };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockResolvedValue({
        ...mockUnit,
        name: 'Kilogramos',
      });

      const result = await service.create(dto as any);
      expect(result.name).toBe('Kilogramos');
    });
  });

  describe('create - description length boundaries', () => {
    it('should fail when description length is 4 (below minimum)', async () => {
      const dto = { ...createDto, description: 'Peso' };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockRejectedValue(
        new Error('Description validation failed'),
      );

      await expect(service.create(dto as any)).rejects.toBeInstanceOf(
        RpcException,
      );
    });

    it('should succeed when description length is 5 (minimum boundary)', async () => {
      const dto = { ...createDto, description: 'Pesos' };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockResolvedValue({
        ...mockUnit,
        description: 'Pesos',
      });

      const result = await service.create(dto as any);
      expect(result.description).toBe('Pesos');
    });

    it('should succeed when description is within boundaries (50)', async () => {
      const dto = {
        ...createDto,
        description: 'Unidad de medida estándar para peso en sistema métrico',
      };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockResolvedValue({
        ...mockUnit,
        description: dto.description,
      });

      const result = await service.create(dto as any);
      expect(result.description).toBe(dto.description);
    });
  });

  describe('create - equivalentValue boundaries', () => {
    it('should fail when equivalentValue is 0 (minimum)', async () => {
      const dto = { ...createDto, equivalentValue: 0 };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockRejectedValue(
        new Error('EquivalentValue validation failed'),
      );

      await expect(service.create(dto as any)).rejects.toBeInstanceOf(
        RpcException,
      );
    });

    it('should succeed when equivalentValue is 0.000001 (above minimum)', async () => {
      const dto = { ...createDto, equivalentValue: 0.000001 };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockResolvedValue({
        ...mockUnit,
        equivalentValue: 0.000001,
      });

      const result = await service.create(dto as any);
      expect(result.equivalentValue).toBe(0.000001);
    });

    it('should succeed when equivalentValue is within boundaries (1000)', async () => {
      const dto = { ...createDto, equivalentValue: 1000 };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockResolvedValue({
        ...mockUnit,
        equivalentValue: 1000,
      });

      const result = await service.create(dto as any);
      expect(result.equivalentValue).toBe(1000);
    });
  });

  describe('create - baseUnit length boundaries', () => {
    it('should fail when baseUnit length is 0 (empty)', async () => {
      const dto = { ...createDto, baseUnit: '' };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockRejectedValue(
        new Error('BaseUnit validation failed'),
      );

      await expect(service.create(dto as any)).rejects.toBeInstanceOf(
        RpcException,
      );
    });

    it('should succeed when baseUnit length is 1 (minimum boundary)', async () => {
      const dto = { ...createDto, baseUnit: 'g' };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockResolvedValue({
        ...mockUnit,
        baseUnit: 'g',
      });

      const result = await service.create(dto as any);
      expect(result.baseUnit).toBe('g');
    });

    it('should succeed when baseUnit is within boundaries (10)', async () => {
      const dto = { ...createDto, baseUnit: 'Miligramo' };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockResolvedValue({
        ...mockUnit,
        baseUnit: 'Miligramo',
      });

      const result = await service.create(dto as any);
      expect(result.baseUnit).toBe('Miligramo');
    });
  });

  describe('create - MeasureType validation', () => {
    it('should succeed when type is valid (WEIGHT)', async () => {
      const dto = { ...createDto, type: MeasureType.WEIGHT };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockResolvedValue({
        ...mockUnit,
        type: MeasureType.WEIGHT,
      });

      const result = await service.create(dto);
      expect(result.type).toBe(MeasureType.WEIGHT);
    });

    it('should fail when type is invalid', async () => {
      const dto = { ...createDto, type: 'INVALID_TYPE' as any };
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockRejectedValue(
        new Error('Type validation failed'),
      );

      await expect(service.create(dto as any)).rejects.toBeInstanceOf(
        RpcException,
      );
    });
  });

  describe('create - uniqueness validation', () => {
    it('should succeed when unit does not exist', async () => {
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.create as jest.Mock).mockResolvedValue(mockUnit);

      const result = await service.create(createDto);
      expect(result).toEqual(mockUnit);
    });

    it('should fail when unit with same name, symbol, and type already exists', async () => {
      (service.unit.findFirst as jest.Mock).mockResolvedValue(mockUnit);

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        RpcException,
      );
      await expect(service.create(createDto)).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining('already exists'),
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all units', async () => {
      const mockUnits = [mockUnit];
      (service.unit.findMany as jest.Mock).mockResolvedValue(mockUnits);

      const result = await service.findAll();
      expect(result).toEqual(mockUnits);
    });

    it('should fail on database error', async () => {
      (service.unit.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findAll()).rejects.toBeInstanceOf(RpcException);
    });
  });

  describe('findOne', () => {
    it('should return unit by id', async () => {
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);

      const result = await service.findOne(mockUnit.id);
      expect(result).toEqual(mockUnit);
    });

    it('should fail when unit not found', async () => {
      (service.unit.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toBeInstanceOf(
        RpcException,
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Gramo',
      symbol: 'g',
    };

    it('should update successfully', async () => {
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.unit.findFirst as jest.Mock).mockResolvedValue(null);
      (service.unit.update as jest.Mock).mockResolvedValue({
        ...mockUnit,
        ...updateDto,
      });

      const result = await service.update(mockUnit.id, updateDto);
      expect(result.name).toBe(updateDto.name);
      expect(result.symbol).toBe(updateDto.symbol);
    });

    it('should fail when no fields provided', async () => {
      await expect(
        service.update(mockUnit.id, {} as any),
      ).rejects.toBeInstanceOf(RpcException);
    });
  });

  describe('remove', () => {
    it('should delete successfully when no offers exist', async () => {
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.productOffer.count as jest.Mock).mockResolvedValue(0);
      (service.unit.delete as jest.Mock).mockResolvedValue(mockUnit);

      const result = await service.remove(mockUnit.id);
      expect(result).toEqual({
        message: 'Unit deleted successfully',
        id: mockUnit.id,
      });
    });

    it('should fail when offers exist', async () => {
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.productOffer.count as jest.Mock).mockResolvedValue(5);

      await expect(service.remove(mockUnit.id)).rejects.toBeInstanceOf(
        RpcException,
      );
      await expect(service.remove(mockUnit.id)).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining('associated offers'),
        }),
      });
    });
  });
});
