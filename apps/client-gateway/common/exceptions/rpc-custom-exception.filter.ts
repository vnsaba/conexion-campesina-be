import {
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

interface RpcErrorShape {
  status?: number;
  message?: string;
  [key: string]: any;
}

@Catch(RpcException)
export class RpcCustomExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => { json: (body: any) => void };
    }>();

    const rpcError = exception.getError(); // Not an instance of RcpException in fact

    if (
      typeof rpcError === 'object' &&
      rpcError &&
      'status' in rpcError &&
      'message' in rpcError
    ) {
      const typedError = rpcError as RpcErrorShape;
      const status =
        typeof typedError.status === 'number'
          ? typedError.status
          : HttpStatus.BAD_REQUEST;
      return response.status(status).json(typedError);
    }

    // Generic error handling
    return response.status(HttpStatus.BAD_REQUEST).json({
      status: HttpStatus.BAD_REQUEST,
      message: typeof rpcError === 'string' ? rpcError : 'Unexpected error',
    });
  }
}
