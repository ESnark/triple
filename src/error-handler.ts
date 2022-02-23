import { PrismaClientKnownRequestError, PrismaClientUnknownRequestError, PrismaClientValidationError } from '@prisma/client/runtime'
import { ValidationError } from 'class-validator'
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express'
import createHttpError from 'http-errors'

const errorResponse = (status = 500, name: string, message: any) => ({ status, name, data: message })

/**
 * class-validator 에러 처리
 * class-validator가 EventsDTO 인스턴스를 검사하고, 유효하지 않은 모든 필드에 대한 정보를 배열로 넘겨주기 때문에 필수적인 정보만 모아서 payload로 넘긴다.
 */
export const classValidatorErrorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (Array.isArray(err) && err[0] instanceof ValidationError) {
    const validationPayload = []
    for (const e of err) {
      if (e instanceof ValidationError === false) continue
      const { value, property, constraints } = e
      validationPayload.push({ property, value, constraints })
    }

    res.status(400)
    res.json(errorResponse(400, 'Validation Error', validationPayload ))
    next()
  }

  next(err)
}

/** http-errors 모듈로 생성된 에러 응답 처리 */
export const httpErrorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (createHttpError.isHttpError(err)) {
    res.status(err.status)
    res.json(errorResponse(err.status, err.name, err.message))
    return next()
  }

  next(err)
}

/** prisma 에러 처리 */
export const prismaErrorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof PrismaClientKnownRequestError) {
    res.status(500)
    res.json(errorResponse(500, 'PrismaClientKnownRequestError', err.message))
  } else if (err instanceof PrismaClientUnknownRequestError) {
    res.status(500)
    res.json(errorResponse(500, 'PrismaClientUnknownRequestError', err.message))
  } else if (err instanceof PrismaClientValidationError) {
    res.status(500)
    res.json(errorResponse(500, 'PrismaClientValidationError', err.message))
  }

  next(err)
}

export const finalErrorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  res.status(500)
  res.json(errorResponse(500, 'Service Unavailable', undefined))
}