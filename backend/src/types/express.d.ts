import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      sub: string;
      username: string;
      role: string;
    };
  }
}
