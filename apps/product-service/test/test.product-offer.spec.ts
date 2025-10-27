import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { ProductOfferService } from '../src/product-offer/product-offer.service';
import { Category } from '../generated/prisma';

describe('ProductOfferService', () => {
  let service: ProductOfferService;

  const mockProductBase = {
    id: '507f1f77bcf86cd799439011',
    name: 'Tomato',
    category: Category.VERDURAS,
  };

  const mockUnit = {
    id: '507f1f77bcf86cd799439013',
    name: 'kg',
    abbreviation: 'kg',
  };

  const mockProductOffer = {
    id: '507f1f77bcf86cd799439012',
    productBaseId: '507f1f77bcf86cd799439011',
    producerId: 'producer123',
    name: 'Organic Tomatoes',
    description: 'Fresh organic tomatoes from local farm',
    price: 5000,
    imageUrl: 'https://example.com/tomato.jpg',
    unitId: '507f1f77bcf86cd799439013',
    quantity: 50,
    isAvailable: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    productBase: mockProductBase,
    unit: mockUnit,
  };

  const createDto = {
    productBaseId: '507f1f77bcf86cd799439011',
    producerId: 'producer123',
    name: 'Organic Tomatoes',
    description: 'Fresh organic tomatoes from local farm',
    price: 5000,
    imageUrl: 'https://example.com/tomato.jpg',
    unitId: '507f1f77bcf86cd799439013',
    quantity: 50,
    isAvailable: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductOfferService],
    }).compile();

    service = module.get<ProductOfferService>(ProductOfferService);

    // Mock prisma models
    Object.defineProperty(service, 'productOffer', {
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

    Object.defineProperty(service, 'productBase', {
      value: {
        findUnique: jest.fn(),
      },
      writable: false,
    });

    Object.defineProperty(service, 'unit', {
      value: {
        findUnique: jest.fn(),
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

  describe('create - price boundaries', () => {
    it('should fail when price is 0 (below minimum)', async () => {
      const dto = { ...createDto, price: 0 };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockRejectedValue(
        new Error('Price validation failed'),
      );

      await expect(service.create(dto as any)).rejects.toBeInstanceOf(
        RpcException,
      );
    });

    it('should succeed when price is 1 (minimum boundary)', async () => {
      const dto = { ...createDto, price: 1 };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockResolvedValue({
        ...mockProductOffer,
        price: 1,
      });

      const result = await service.create(dto as any);
      expect(result.price).toBe(1);
    });

    it('should succeed when price is within boundaries (5000)', async () => {
      const dto = { ...createDto, price: 5000 };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockResolvedValue({
        ...mockProductOffer,
        price: 5000,
      });

      const result = await service.create(dto as any);
      expect(result.price).toBe(5000);
    });
  });

  describe('create - quantity boundaries', () => {
    it('should fail when quantity is 0 (below minimum)', async () => {
      const dto = { ...createDto, quantity: 0 };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockRejectedValue(
        new Error('Quantity validation failed'),
      );

      await expect(service.create(dto as any)).rejects.toBeInstanceOf(
        RpcException,
      );
    });

    it('should succeed when quantity is 1 (minimum boundary)', async () => {
      const dto = { ...createDto, quantity: 1 };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockResolvedValue({
        ...mockProductOffer,
        quantity: 1,
      });

      const result = await service.create(dto as any);
      expect(result.quantity).toBe(1);
    });

    it('should succeed when quantity is within boundaries (50)', async () => {
      const dto = { ...createDto, quantity: 50 };
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockResolvedValue({
        ...mockProductOffer,
        quantity: 50,
      });

      const result = await service.create(dto as any);
      expect(result.quantity).toBe(50);
    });
  });

  describe('create - ProductBase relationship', () => {
    it('should succeed when ProductBase exists', async () => {
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );

      const result = await service.create(createDto);
      expect(result).toEqual(mockProductOffer);
      expect(result.productBase).toBeDefined();
    });

    it('should fail when ProductBase does not exist', async () => {
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        RpcException,
      );
      await expect(service.create(createDto)).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining('ProductBase'),
        }),
      });
    });
  });

  describe('create - Unit relationship', () => {
    it('should succeed when Unit exists', async () => {
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );

      const result = await service.create(createDto);
      expect(result.unit).toBeDefined();
      expect(result.unitId).toBe(mockUnit.id);
    });

    it('should fail when Unit does not exist', async () => {
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.unit.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        RpcException,
      );
      await expect(service.create(createDto)).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining('Unit'),
        }),
      });
    });
  });

  describe('create - multiple offers for same ProductBase', () => {
    it('should succeed creating multiple offers for same ProductBase', async () => {
      const offer1 = {
        ...createDto,
        name: 'Offer 1',
        producerId: 'producer1',
      };
      const offer2 = {
        ...createDto,
        name: 'Offer 2',
        producerId: 'producer2',
      };

      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(null);
      (service.productOffer.create as jest.Mock)
        .mockResolvedValueOnce({ ...mockProductOffer, ...offer1 })
        .mockResolvedValueOnce({ ...mockProductOffer, ...offer2 });

      const result1 = await service.create(offer1);
      const result2 = await service.create(offer2);

      expect(result1.productBaseId).toBe(result2.productBaseId);
      expect(result1.producerId).not.toBe(result2.producerId);
    });

    it('should fail when same producer creates duplicate offer', async () => {
      (service.productBase.findUnique as jest.Mock).mockResolvedValue(
        mockProductBase,
      );
      (service.unit.findUnique as jest.Mock).mockResolvedValue(mockUnit);
      (service.productOffer.findFirst as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );

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
    it('should return all product offers', async () => {
      const mockOffers = [mockProductOffer];
      (service.productOffer.findMany as jest.Mock).mockResolvedValue(
        mockOffers,
      );

      const result = await service.findAll();
      expect(result).toEqual(mockOffers);
    });

    it('should fail on database error', async () => {
      (service.productOffer.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findAll()).rejects.toBeInstanceOf(RpcException);
    });
  });

  describe('findOne', () => {
    it('should return product offer by id', async () => {
      (service.productOffer.findUnique as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );

      const result = await service.findOne(mockProductOffer.id);
      expect(result).toEqual(mockProductOffer);
    });

    it('should fail when product offer not found', async () => {
      (service.productOffer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toBeInstanceOf(
        RpcException,
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Tomatoes',
      price: 6000,
    };

    it('should update successfully', async () => {
      (service.productOffer.findUnique as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );
      (service.productOffer.update as jest.Mock).mockResolvedValue({
        ...mockProductOffer,
        ...updateDto,
      });

      const result = await service.update(mockProductOffer.id, updateDto);
      expect(result.name).toBe(updateDto.name);
      expect(result.price).toBe(updateDto.price);
    });

    it('should fail when no fields provided', async () => {
      await expect(
        service.update(mockProductOffer.id, {} as any),
      ).rejects.toBeInstanceOf(RpcException);
    });
  });

  describe('remove', () => {
    it('should delete successfully', async () => {
      (service.productOffer.findUnique as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );
      (service.productOffer.delete as jest.Mock).mockResolvedValue(
        mockProductOffer,
      );

      const result = await service.remove(mockProductOffer.id);
      expect(result).toEqual({
        message: 'ProductOffer deleted successfully',
        id: mockProductOffer.id,
      });
    });

    it('should fail when product offer not found', async () => {
      (service.productOffer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toBeInstanceOf(
        RpcException,
      );
    });
  });
});

//       const findFirstSpy = jest
//         .spyOn(service.productOffer, 'findFirst')
//         .mockResolvedValue(null);
//       const createSpy = jest
//         .spyOn(service.productOffer, 'create')
//         .mockResolvedValue(mockProductOffer as any);

//       const result = await service.create(createDto);

//       expect(result).toEqual(mockProductOffer);
//       expect(findFirstSpy).toHaveBeenCalledWith({
//         where: {
//           productBaseId: createDto.productBaseId,
//           producerId: createDto.producerId,
//           name: createDto.name,
//         },
//       });
//       expect(createSpy).toHaveBeenCalledWith({
//         data: createDto,
//         include: { productBase: true },
//       });
//     });

//     it('should throw RpcException when product offer already exists', async () => {
//       jest
//         .spyOn(service.productOffer, 'findFirst')
//         .mockResolvedValue(mockProductOffer as any);

//       await expect(service.create(createDto)).rejects.toThrow(RpcException);
//       await expect(service.create(createDto)).rejects.toThrow(/already exists/);
//     });

//     it('should throw RpcException on database error', async () => {
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest
//         .spyOn(service.productOffer, 'create')
//         // .mockRejectedValue(new Error('Database error'));

//       await expect(service.create(createDto)).rejects.toThrow(RpcException);
//     });

//     it('should fail when creating with invalid productBaseId', async () => {
//       const invalidDto = { ...createDto, productBaseId: 'invalid-id' };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest
//         .spyOn(service.productOffer, 'create')
//         .mockRejectedValue(new Error('Invalid ObjectId'));

//       await expect(service.create(invalidDto)).rejects.toThrow(RpcException);
//     });

//     it('should fail when creating with negative price', async () => {
//       const invalidDto = { ...createDto, price: -100 };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest
//         .spyOn(service.productOffer, 'create')
//         .mockRejectedValue(new Error('Price must be positive'));

//       await expect(service.create(invalidDto)).rejects.toThrow(RpcException);
//     });

//     it('should fail when price is zero', async () => {
//       const invalidDto = { ...createDto, price: 0 };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest
//         .spyOn(service.productOffer, 'create')
//         .mockRejectedValue(new Error('Price must be greater than 0'));

//       await expect(service.create(invalidDto)).rejects.toThrow(RpcException);
//     });

//     it('should fail when name is empty', async () => {
//       const invalidDto = { ...createDto, name: '' };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest
//         .spyOn(service.productOffer, 'create')
//         .mockRejectedValue(new Error('Name is required'));

//       await expect(service.create(invalidDto)).rejects.toThrow(RpcException);
//     });
//   });

//   describe('findAll', () => {
//     it('should return all product offers', async () => {
//       const mockProductOffers = [mockProductOffer];
//       const findManySpy = jest
//         .spyOn(service.productOffer, 'findMany')
//         .mockResolvedValue(mockProductOffers as any);

//       const result = await service.findAll();

//       expect(result).toEqual(mockProductOffers);
//       expect(findManySpy).toHaveBeenCalledWith({
//         include: { productBase: true },
//         orderBy: { createdAt: 'desc' },
//       });
//     });

//     it('should return empty array when no offers exist', async () => {
//       jest.spyOn(service.productOffer, 'findMany').mockResolvedValue([]);

//       const result = await service.findAll();

//       expect(result).toEqual([]);
//       expect(result.length).toBe(0);
//     });

//     it('should throw RpcException on database error', async () => {
//       jest
//         .spyOn(service.productOffer, 'findMany')
//         .mockRejectedValue(new Error('Database error'));

//       await expect(service.findAll()).rejects.toThrow(RpcException);
//     });
//   });

//   describe('findOne', () => {
//     it('should return a product offer by id', async () => {
//       const findUniqueSpy = jest
//         .spyOn(service.productOffer, 'findUnique')
//         .mockResolvedValue(mockProductOffer as any);

//       const result = await service.findOne(mockProductOffer.id);

//       expect(result).toEqual(mockProductOffer);
//       expect(findUniqueSpy).toHaveBeenCalledWith({
//         where: { id: mockProductOffer.id },
//         include: { productBase: true },
//       });
//     });

//     it('should throw RpcException when product offer not found', async () => {
//       const id = 'nonexistent-id';
//       jest.spyOn(service.productOffer, 'findUnique').mockResolvedValue(null);

//       await expect(service.findOne(id)).rejects.toThrow(RpcException);
//       await expect(service.findOne(id)).rejects.toThrow(/not found/);
//     });

//     it('should throw RpcException on database error', async () => {
//       jest
//         .spyOn(service.productOffer, 'findUnique')
//         .mockRejectedValue(new Error('Database error'));

//       await expect(service.findOne('some-id')).rejects.toThrow(RpcException);
//     });
//   });

//   describe('update', () => {
//     const updateDto = {
//       name: 'Premium Organic Tomatoes',
//       price: 7000,
//       description: 'Premium quality organic tomatoes',
//     };

//     it('should successfully update a product offer', async () => {
//       const updatedOffer = { ...mockProductOffer, ...updateDto };
//       jest.spyOn(service, 'findOne').mockResolvedValue(mockProductOffer as any);
//       const updateSpy = jest
//         .spyOn(service.productOffer, 'update')
//         .mockResolvedValue(updatedOffer as any);

//       const result = await service.update(mockProductOffer.id, updateDto);

//       expect(result).toEqual(updatedOffer);
//       expect(updateSpy).toHaveBeenCalledWith({
//         where: { id: mockProductOffer.id },
//         data: updateDto,
//         include: { productBase: true },
//       });
//     });

//     it('should throw RpcException when no fields provided', async () => {
//       await expect(service.update(mockProductOffer.id, {})).rejects.toThrow(
//         RpcException,
//       );
//       await expect(service.update(mockProductOffer.id, {})).rejects.toThrow(
//         /At least one field/,
//       );
//     });

//     it('should throw RpcException when product offer not found', async () => {
//       jest.spyOn(service, 'findOne').mockRejectedValue(
//         new RpcException({
//           status: HttpStatus.NOT_FOUND,
//           message: 'Not found',
//         }),
//       );

//       await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(
//         RpcException,
//       );
//     });

//     it('should successfully update only price', async () => {
//       const priceUpdateDto = { price: 6000 };
//       const updatedOffer = { ...mockProductOffer, price: 6000 };
//       jest.spyOn(service, 'findOne').mockResolvedValue(mockProductOffer as any);
//       jest
//         .spyOn(service.productOffer, 'update')
//         .mockResolvedValue(updatedOffer as any);

//       const result = await service.update(mockProductOffer.id, priceUpdateDto);

//       expect(result.price).toBe(6000);
//       expect(result.name).toBe(mockProductOffer.name);
//     });

//     it('should throw RpcException on database error during update', async () => {
//       jest.spyOn(service, 'findOne').mockResolvedValue(mockProductOffer as any);
//       jest
//         .spyOn(service.productOffer, 'update')
//         .mockRejectedValue(new Error('Database error'));

//       await expect(
//         service.update(mockProductOffer.id, updateDto),
//       ).rejects.toThrow(RpcException);
//     });
//   });

//   describe('remove', () => {
//     it('should successfully delete a product offer', async () => {
//       jest.spyOn(service, 'findOne').mockResolvedValue(mockProductOffer as any);
//       const deleteSpy = jest
//         .spyOn(service.productOffer, 'delete')
//         .mockResolvedValue(mockProductOffer as any);

//       const result = await service.remove(mockProductOffer.id);

//       expect(result).toEqual({
//         message: 'ProductOffer deleted successfully',
//         id: mockProductOffer.id,
//       });
//       expect(deleteSpy).toHaveBeenCalledWith({
//         where: { id: mockProductOffer.id },
//       });
//     });

//     it('should throw RpcException when product offer not found', async () => {
//       jest.spyOn(service, 'findOne').mockRejectedValue(
//         new RpcException({
//           status: HttpStatus.NOT_FOUND,
//           message: 'Not found',
//         }),
//       );

//       await expect(service.remove('nonexistent-id')).rejects.toThrow(
//         RpcException,
//       );
//       await expect(service.remove('nonexistent-id')).rejects.toThrow(
//         /not found/i,
//       );
//     });

//     it('should throw RpcException on database error during deletion', async () => {
//       jest.spyOn(service, 'findOne').mockResolvedValue(mockProductOffer as any);
//       jest
//         .spyOn(service.productOffer, 'delete')
//         .mockRejectedValue(new Error('Database error'));

//       await expect(service.remove(mockProductOffer.id)).rejects.toThrow(
//         RpcException,
//       );
//     });
//   });

//   describe('Authorization scenarios', () => {
//     it('should allow ADMIN to create product offer', async () => {
//       const adminCreateDto = { ...createDto, producerId: 'admin-user-123' };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest.spyOn(service.productOffer, 'create').mockResolvedValue({
//         ...mockProductOffer,
//         producerId: 'admin-user-123',
//       } as any);

//       const result = await service.create(adminCreateDto);

//       expect(result).toBeDefined();
//       expect(result.producerId).toBe('admin-user-123');
//     });

//     it('should allow PRODUCER to create product offer', async () => {
//       const producerCreateDto = {
//         ...createDto,
//         producerId: 'producer-user-456',
//       };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest.spyOn(service.productOffer, 'create').mockResolvedValue({
//         ...mockProductOffer,
//         producerId: 'producer-user-456',
//       } as any);

//       const result = await service.create(producerCreateDto);

//       expect(result).toBeDefined();
//       expect(result.producerId).toBe('producer-user-456');
//     });

//     it('should fail when producerId is missing', async () => {
//       const invalidDto = { ...createDto, producerId: '' };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest
//         .spyOn(service.productOffer, 'create')
//         .mockRejectedValue(new Error('ProducerId is required'));

//       await expect(service.create(invalidDto)).rejects.toThrow(RpcException);
//     });

//     it('should fail when unauthorized (missing token)', async () => {
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest.spyOn(service.productOffer, 'create').mockRejectedValue(
//         new RpcException({
//           status: HttpStatus.UNAUTHORIZED,
//           message: 'Unauthorized',
//         }),
//       );

//       await expect(service.create(createDto)).rejects.toThrow(RpcException);
//       await expect(service.create(createDto)).rejects.toThrow(/unauthorized/i);
//     });

//     it('should forbid CLIENT role to create offers', async () => {
//       const clientDto = { ...createDto, producerId: 'client-user-999' };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest.spyOn(service.productOffer, 'create').mockRejectedValue(
//         new RpcException({
//           status: HttpStatus.FORBIDDEN,
//           message: 'Forbidden',
//         }),
//       );

//       await expect(service.create(clientDto)).rejects.toThrow(RpcException);
//       await expect(service.create(clientDto)).rejects.toThrow(/forbidden/i);
//     });
//   });

//   describe('Validation scenarios', () => {
//     it('should fail with invalid image URL', async () => {
//       const invalidDto = { ...createDto, imageUrl: 'not-a-valid-url' };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest
//         .spyOn(service.productOffer, 'create')
//         .mockRejectedValue(new Error('Invalid URL format'));

//       await expect(service.create(invalidDto)).rejects.toThrow(RpcException);
//     });

//     it('should fail with description too short', async () => {
//       const invalidDto = { ...createDto, description: 'Short' };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest
//         .spyOn(service.productOffer, 'create')
//         .mockRejectedValue(new Error('Description too short'));

//       await expect(service.create(invalidDto)).rejects.toThrow(RpcException);
//     });

//     it('should fail with price below minimum', async () => {
//       const invalidDto = { ...createDto, price: 5 };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest
//         .spyOn(service.productOffer, 'create')
//         .mockRejectedValue(new Error('Price below minimum'));

//       await expect(service.create(invalidDto)).rejects.toThrow(RpcException);
//     });
//   });

//   describe('Integration scenarios', () => {
//     it('should create multiple offers for the same product base', async () => {
//       const offer1 = { ...createDto, name: 'Offer 1', producerId: 'producer1' };
//       const offer2 = { ...createDto, name: 'Offer 2', producerId: 'producer2' };

//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest
//         .spyOn(service.productOffer, 'create')
//         .mockResolvedValueOnce({ ...mockProductOffer, ...offer1 } as any)
//         .mockResolvedValueOnce({ ...mockProductOffer, ...offer2 } as any);

//       const result1 = await service.create(offer1);
//       const result2 = await service.create(offer2);

//       expect(result1.name).toBe('Offer 1');
//       expect(result2.name).toBe('Offer 2');
//       expect(result1.productBaseId).toBe(result2.productBaseId);
//     });

//     it('should prevent duplicate offers from same producer', async () => {
//       jest
//         .spyOn(service.productOffer, 'findFirst')
//         .mockResolvedValue(mockProductOffer as any);

//       await expect(service.create(createDto)).rejects.toThrow(RpcException);
//       await expect(service.create(createDto)).rejects.toThrow(/already exists/);
//     });
//   });

//   describe('Edge cases', () => {
//     it('should handle very long product names', async () => {
//       const longNameDto = { ...createDto, name: 'A'.repeat(255) };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest.spyOn(service.productOffer, 'create').mockResolvedValue({
//         ...mockProductOffer,
//         name: longNameDto.name,
//       } as any);

//       const result = await service.create(longNameDto);

//       expect(result.name).toBe(longNameDto.name);
//       expect(result.name.length).toBe(255);
//     });

//     it('should handle maximum price value', async () => {
//       const maxPriceDto = { ...createDto, price: Number.MAX_SAFE_INTEGER };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest.spyOn(service.productOffer, 'create').mockResolvedValue({
//         ...mockProductOffer,
//         price: maxPriceDto.price,
//       } as any);

//       const result = await service.create(maxPriceDto);

//       expect(result.price).toBe(Number.MAX_SAFE_INTEGER);
//     });

//     it('should handle special characters in description', async () => {
//       const specialCharsDto = {
//         ...createDto,
//         description: 'Fresh 🍅 tomatoes with special chars: @#$%^&*()',
//       };
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest.spyOn(service.productOffer, 'create').mockResolvedValue({
//         ...mockProductOffer,
//         description: specialCharsDto.description,
//       } as any);

//       const result = await service.create(specialCharsDto);

//       expect(result.description).toContain('🍅');
//       expect(result.description).toContain('@#$%^&*()');
//     });
//   });

//   describe('Performance scenarios', () => {
//     it('should handle concurrent updates gracefully', async () => {
//       const updateDto1 = { price: 6000 };
//       const updateDto2 = { name: 'Updated Name' };

//       jest.spyOn(service, 'findOne').mockResolvedValue(mockProductOffer as any);
//       jest
//         .spyOn(service.productOffer, 'update')
//         .mockResolvedValueOnce({ ...mockProductOffer, ...updateDto1 } as any)
//         .mockResolvedValueOnce({ ...mockProductOffer, ...updateDto2 } as any);

//       const [result1, result2] = await Promise.all([
//         service.update(mockProductOffer.id, updateDto1),
//         service.update(mockProductOffer.id, updateDto2),
//       ]);

//       expect(result1.price).toBe(6000);
//       expect(result2.name).toBe('Updated Name');
//     });

//     it('should batch process multiple product offers', async () => {
//       const offers = Array.from({ length: 10 }, (_, i) => ({
//         ...createDto,
//         name: `Offer ${i}`,
//         producerId: `producer${i}`,
//       }));

//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       const createSpy: any = jest.spyOn(service.productOffer, 'create');

//       for (const offer of offers) {
//         createSpy.mockResolvedValueOnce({
//           ...mockProductOffer,
//           name: offer.name,
//           producerId: offer.producerId,
//         } as any);
//       }

//       const results = await Promise.all(
//         offers.map((offer) => service.create(offer)),
//       );

//       expect(results).toHaveLength(10);
//       expect(results.every((r) => r.id)).toBe(true);
//     });
//   });

//   describe('Data consistency', () => {
//     it('should maintain relationship integrity between offer and base', async () => {
//       jest.spyOn(service.productOffer, 'findFirst').mockResolvedValue(null);
//       jest
//         .spyOn(service.productOffer, 'create')
//         .mockResolvedValue(mockProductOffer as any);

//       const result = await service.create(createDto);

//       expect(result.productBase).toBeDefined();
//       expect(result.productBase.id).toBe(result.productBaseId);
//       expect(result.productBase.name).toBe(mockProductBase.name);
//     });

//     it('should preserve timestamps on update', async () => {
//       const originalCreatedAt = mockProductOffer.createdAt;
//       const updDto = { price: 6000 };
//       const updatedOffer = {
//         ...mockProductOffer,
//         ...updDto,
//         updatedAt: new Date(),
//       };

//       jest.spyOn(service, 'findOne').mockResolvedValue(mockProductOffer as any);
//       jest
//         .spyOn(service.productOffer, 'update')
//         .mockResolvedValue(updatedOffer as any);

//       const result = await service.update(mockProductOffer.id, updDto);

//       expect(result.createdAt).toEqual(originalCreatedAt);
//       expect(result.updatedAt).not.toEqual(originalCreatedAt);
//     });
//   });
// });
