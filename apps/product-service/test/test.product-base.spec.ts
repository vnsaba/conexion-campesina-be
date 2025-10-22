// import { Test, TestingModule } from '@nestjs/testing';
// import { HttpStatus } from '@nestjs/common';
// import { RpcException } from '@nestjs/microservices';
// import { ProductBaseService } from '../src/product-base/product-base.service';
// import { Category } from '../generated/prisma';

// describe('ProductBaseService', () => {
//   let service: ProductBaseService;

//   const mockProductBase = {
//     id: '507f1f77bcf86cd799439011',
//     name: 'Tomato',
//     category: Category.VEGETABLES,
//     offers: [],
//   };

//   const createDto = {
//     name: 'Tomato',
//     category: Category.VEGETABLES,
//   };

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [ProductBaseService],
//     }).compile();

//     service = module.get<ProductBaseService>(ProductBaseService);

//     service.$connect = jest.fn().mockResolvedValue(undefined);
//     service.$disconnect = jest.fn().mockResolvedValue(undefined);
//   });

//   afterEach(async () => {
//     await service.$disconnect();
//     jest.clearAllMocks();
//   });

//   describe('create', () => {
//     it('should successfully create a product base', async () => {
//       const findFirstSpy = jest
//         .spyOn(service.productBase, 'findFirst')
//         .mockResolvedValue(null);
//       const createSpy = jest
//         .spyOn(service.productBase, 'create')
//         .mockResolvedValue(mockProductBase as any);

//       const result = await service.create(createDto);

//       expect(result).toEqual(mockProductBase);
//       expect(findFirstSpy).toHaveBeenCalledWith({
//         where: { name: createDto.name, category: createDto.category },
//       });
//       expect(createSpy).toHaveBeenCalledWith({
//         data: createDto,
//       });
//     });

//     it('should throw RpcException when product base already exists', async () => {
//       jest
//         .spyOn(service.productBase, 'findFirst')
//         .mockResolvedValue(mockProductBase as any);

//       try {
//         await service.create(createDto);
//         fail('Should have thrown RpcException');
//       } catch (error) {
//         expect(error).toBeInstanceOf(RpcException);
//         expect(error.message).toContain('already exists');
//       }
//     });

//     it('should throw RpcException on database error', async () => {
//       jest.spyOn(service.productBase, 'findFirst').mockResolvedValue(null);
//       jest
//         .spyOn(service.productBase, 'create')
//         .mockRejectedValue(new Error('Database error'));

//       try {
//         await service.create(createDto);
//         fail('Should have thrown RpcException');
//       } catch (error) {
//         expect(error).toBeInstanceOf(RpcException);
//       }
//     });
//   });

//   describe('findAll', () => {
//     it('should return all product bases', async () => {
//       const mockProductBases = [mockProductBase];
//       const findManySpy = jest
//         .spyOn(service.productBase, 'findMany')
//         .mockResolvedValue(mockProductBases as any);

//       const result = await service.findAll();

//       expect(result).toEqual(mockProductBases);
//       expect(findManySpy).toHaveBeenCalledWith({
//         orderBy: { name: 'asc' },
//       });
//     });

//     it('should throw RpcException on database error', async () => {
//       jest
//         .spyOn(service.productBase, 'findMany')
//         .mockRejectedValue(new Error('Database error'));

//       try {
//         await service.findAll();
//         fail('Should have thrown RpcException');
//       } catch (error) {
//         expect(error).toBeInstanceOf(RpcException);
//       }
//     });
//   });

//   describe('findOne', () => {
//     it('should return a product base by id', async () => {
//       const findUniqueSpy = jest
//         .spyOn(service.productBase, 'findUnique')
//         .mockResolvedValue(mockProductBase as any);

//       const result = await service.findOne(mockProductBase.id);

//       expect(result).toEqual(mockProductBase);
//       expect(findUniqueSpy).toHaveBeenCalledWith({
//         where: { id: mockProductBase.id },
//         include: { offers: true },
//       });
//     });

//     it('should throw RpcException when product base not found', async () => {
//       const id = 'nonexistent-id';
//       jest.spyOn(service.productBase, 'findUnique').mockResolvedValue(null);

//       try {
//         await service.findOne(id);
//         fail('Should have thrown RpcException');
//       } catch (error) {
//         expect(error).toBeInstanceOf(RpcException);
//         expect(error.message).toContain('not found');
//       }
//     });
//   });

//   describe('update', () => {
//     const updateDto = { name: 'Updated Tomato' };

//     it('should successfully update a product base', async () => {
//       const updatedProduct = { ...mockProductBase, ...updateDto };
//       jest.spyOn(service, 'findOne').mockResolvedValue(mockProductBase as any);
//       const updateSpy = jest
//         .spyOn(service.productBase, 'update')
//         .mockResolvedValue(updatedProduct as any);

//       const result = await service.update(mockProductBase.id, updateDto);

//       expect(result).toEqual(updatedProduct);
//       expect(updateSpy).toHaveBeenCalledWith({
//         where: { id: mockProductBase.id },
//         data: updateDto,
//       });
//     });

//     it('should throw RpcException when no fields provided', async () => {
//       try {
//         await service.update(mockProductBase.id, {});
//         fail('Should have thrown RpcException');
//       } catch (error) {
//         expect(error).toBeInstanceOf(RpcException);
//         expect(error.message).toContain('At least one field');
//       }
//     });

//     it('should throw RpcException when product base not found', async () => {
//       jest.spyOn(service, 'findOne').mockRejectedValue(
//         new RpcException({
//           status: HttpStatus.NOT_FOUND,
//           message: 'Product base not found',
//         }),
//       );

//       try {
//         await service.update('nonexistent-id', updateDto);
//         fail('Should have thrown RpcException');
//       } catch (error) {
//         expect(error).toBeInstanceOf(RpcException);
//       }
//     });
//   });

//   describe('remove', () => {
//     it('should successfully delete a product base', async () => {
//       jest.spyOn(service, 'findOne').mockResolvedValue(mockProductBase as any);
//       const countSpy = jest
//         .spyOn(service.productOffer, 'count')
//         .mockResolvedValue(0);
//       const deleteSpy = jest
//         .spyOn(service.productBase, 'delete')
//         .mockResolvedValue(mockProductBase as any);

//       const result = await service.remove(mockProductBase.id);

//       expect(result).toEqual({
//         message: 'ProductBase deleted successfully',
//         id: mockProductBase.id,
//       });
//       expect(countSpy).toHaveBeenCalledWith({
//         where: { productBaseId: mockProductBase.id },
//       });
//       expect(deleteSpy).toHaveBeenCalledWith({
//         where: { id: mockProductBase.id },
//       });
//     });

//     it('should throw RpcException when product base not found', async () => {
//       jest.spyOn(service, 'findOne').mockRejectedValue(
//         new RpcException({
//           status: HttpStatus.NOT_FOUND,
//           message: `ProductBase with id 'nonexistent-id' not found`,
//         }),
//       );

//       try {
//         await service.remove('nonexistent-id');
//         fail('Should have thrown RpcException');
//       } catch (error) {
//         expect(error).toBeInstanceOf(RpcException);
//         expect(error.message).toContain('not found');
//       }
//     });

//     it('should throw RpcException when product base has associated offers', async () => {
//       jest.spyOn(service, 'findOne').mockResolvedValue(mockProductBase as any);
//       jest.spyOn(service.productOffer, 'count').mockResolvedValue(5);

//       try {
//         await service.remove(mockProductBase.id);
//         fail('Should have thrown RpcException');
//       } catch (error) {
//         expect(error).toBeInstanceOf(RpcException);
//         expect(error.message).toContain('associated offers');
//       }
//     });
//   });
// });
