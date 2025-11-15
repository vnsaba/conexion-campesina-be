import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @MessagePattern('create.Review')
  create(
    @Payload()
    payload: {
      clientId: string;
      createReview: CreateReviewDto;
    },
  ) {
    const { clientId, createReview } = payload;
    return this.reviewService.create(createReview, clientId);
  }

  @MessagePattern('findAll.Review')
  findAll() {
    return this.reviewService.findAll();
  }

  @MessagePattern('findAll.Review.ProductOffer')
  findAllProductOffer(@Payload() productOfferId: string) {
    return this.reviewService.findAllProductOffer(productOfferId);
  }

  @MessagePattern('findAll.Review.Client')
  findAllClient(@Payload() clientId: string) {
    return this.reviewService.findAllClientReview(clientId);
  }

  @MessagePattern('findOne.Review')
  findOne(@Payload() id: string) {
    return this.reviewService.findOne(id);
  }

  @MessagePattern('findAverageRating.Review.ProductOffer')
  findAverageRating(@Payload() productOfferId: string) {
    return this.reviewService.findAverageRatingProduct(productOfferId);
  }

  @MessagePattern('update.Review')
  update(
    @Payload()
    payload: {
      id: string;
      clientId: string;
      updateReview: UpdateReviewDto;
    },
  ) {
    const { id, clientId, updateReview } = payload;
    return this.reviewService.update(id, updateReview, clientId);
  }

  @MessagePattern('remove.Review.Client')
  removeClient(@Payload() payload: { id: string; clientId: string }) {
    const { id, clientId } = payload;
    return this.reviewService.remove(id, clientId);
  }

  @MessagePattern('remove.Review.Admin')
  removeAdmin(@Payload() id: string) {
    return this.reviewService.remove(id);
  }
}
