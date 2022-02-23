import express, { Request, Response, NextFunction } from 'express'
import { EventsDTOValidator } from './dto-validator'
import { readPointLogService, reviewEventService } from './services'
import asyncHandler from 'express-async-handler'
import { classValidatorErrorHandler, httpErrorHandler, finalErrorHandler, prismaErrorHandler } from './error-handler'
import createHttpError from 'http-errors'

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// routers
app.post('/events', EventsDTOValidator, asyncHandler(reviewEventService))
app.get('/user/:userId/points', asyncHandler(readPointLogService))

// Not Found Exception
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new createHttpError.NotFound(`Cannot ${req.method} ${req.path}`))
})

// Error handlers
app.use(classValidatorErrorHandler)
app.use(httpErrorHandler)
app.use(prismaErrorHandler)
app.use(finalErrorHandler)

app.listen(3000, () => {
  console.log('Server runnning')
})
