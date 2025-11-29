import { HttpStatus, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

export class RpcError {
  static badRequest(message: string) {
    return new RpcException({ status: HttpStatus.BAD_REQUEST, message });
  }

  static notFound(message: string) {
    return new RpcException({ status: HttpStatus.NOT_FOUND, message });
  }

  static conflict(message: string) {
    return new RpcException({ status: HttpStatus.CONFLICT, message });
  }

  static unauthorized(message = 'Unauthorized') {
    return new RpcException({ status: HttpStatus.UNAUTHORIZED, message });
  }

  static internal(message = 'Internal server error') {
    return new RpcException({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
    });
  }

  /**
   * Método auxiliar para loguear errores y lanzar RpcException interna
   */
  static handle(
    logger: Logger,
    context: string,
    error: unknown,
    message: string,
  ) {
    logger.error(`[${context}] ${message}`, (error as Error).stack);
    if (error instanceof RpcException) {
      throw error; // respeta errores correctos
    }
    throw RpcError.internal(message);
  }
}
