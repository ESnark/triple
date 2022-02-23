import { Request, Response, NextFunction } from 'express'
import { pointLog, PrismaClient, review } from '@prisma/client'
import { EventsDTO } from './dto-validator'
import createError from 'http-errors'

const prisma = new PrismaClient()

type PointLog = {
  reviewId: string,
  userId: string,
  placeId: string,
  pContent: number,
  pPhoto: number,
  pFirst: number,
}

export const reviewEventService = async ({ body }: Request, res: Response, next: NextFunction) => {
  const event = new EventsDTO(body)
  
  if (event.action === 'ADD') {
    await addEvent(event)
  } else if (event.action === 'DELETE') {
    await deleteEvent(event)
  } else if (event.action === 'MOD') {
    await modEvent(event)
  } else {
    throw new createError.BadRequest()
  }

  res.json({
    staus: 'OK',
    data: { action: event.action }
  })
}

export const readPointLogService = async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params
  const { sum } = req.query
  const result: any = {}
  if (!userId) return next(new createError.BadRequest())

  // 기본 limit를 30으로 지정하고 cursor 방식으로 추가적인 log 조회
  const limit = Number(req.query.limit || 30)
  let cursor = req.query.cursor ? Number.parseInt(req.query.cursor as string) : false
      cursor = Number.isNaN(cursor) ? false : cursor

  const findOption: any = {
    where: { userId },
    select: { id: true, reviewId: true, placeId: true, pContent: true, pPhoto: true, pFirst: true },
    take: limit,
    orderBy: { id: 'desc' }
  }

  if (cursor) {
    findOption.cursor = { id: cursor }
    findOption.skip = 1
  }

  result.logs = await prisma.pointLog.findMany(findOption)

  if (sum) {
    const sum: any = await prisma.$queryRaw`SELECT SUM(pContent + pPhoto + pFirst) AS total FROM pointLog WHERE userId=${userId}`
    result.total = sum[0].total
  }
  res.json(result)
}

const addEvent = async (event: EventsDTO) => {
  const { reviewId, userId, placeId } = event
  const newPointLog: PointLog = { reviewId, userId, placeId, pContent: 0, pPhoto: 0, pFirst: 0 }

  // placeId의 최초 리뷰 검색
  const firstReview = await prisma.review.findFirst({
    where: { placeId },
    orderBy: { createdAt: 'asc' }
  })

  // 포인트 가점량 계산
  if (!firstReview) newPointLog.pFirst = 1
  if (event.contentValid) newPointLog.pContent = 1
  if (event.photosValid) newPointLog.pPhoto = 1

  // 리뷰 & 포인트 기록 트랜잭션
  return prisma.$transaction([
    prisma.review.create({
      data: { reviewId, userId, placeId, content: event.contentValid, photos: event.photosValid }
    }),
    prisma.pointLog.create({ data: newPointLog })
  ])
}

const deleteEvent = async (event: EventsDTO) => {
  const { reviewId, userId, placeId } = event
  const newPointLog: PointLog = { reviewId, userId, placeId, pContent: 0, pPhoto: 0, pFirst: 0 }

  // placeId의 최초 리뷰 검색
  prisma.review.findFirst({
    where: { placeId },
    orderBy: { createdAt: 'asc' }
  })
  const firstReview = await prisma.review.findFirst({
    where: { placeId },
    orderBy: { createdAt: 'asc' },
  })

  // 삭제하고자 하는 리뷰 검색
  const formerReview = await prisma.review.findFirst({ where: { placeId, userId } })
  if (!formerReview) throw new createError.NotFound()

  // 삭제할 리뷰의 포인트 경감량 계산
  if (formerReview?.content) newPointLog.pContent = -1
  if (formerReview?.photos) newPointLog.pPhoto = -1
  if (firstReview?.reviewId === reviewId) newPointLog.pFirst = -1

  // 리뷰 삭제 & 포인트 기록 트랜잭션
  return prisma.$transaction([
    prisma.review.delete({ where: { reviewId } }),
    prisma.pointLog.create({ data: newPointLog })
  ])
}

const modEvent = async (event: EventsDTO) => {
  const { reviewId, userId, placeId } = event
  const newPointLog: PointLog = { reviewId, userId, placeId, pContent: 0, pPhoto: 0, pFirst: 0 }

  // 수정할 리뷰 검색
  const formerReview = await prisma.review.findFirst({ where: { reviewId } })
  if (!formerReview) throw new createError.NotFound()

  // 포인트 증감량 계산
  const formerContent = !!formerReview?.content
  const formerPhotos = !!formerReview?.photos
  const newContent = event.contentValid
  const newPhotos = event.photosValid

  if (formerContent && !newContent) newPointLog.pContent--
  if (!formerContent && newContent) newPointLog.pContent++
  if (formerPhotos && !newPhotos) newPointLog.pPhoto--
  if (!formerPhotos && newPhotos) newPointLog.pPhoto++

  const { pContent, pPhoto, pFirst } = newPointLog
  if (pContent === 0 && pPhoto === 0 && pFirst === 0) return

  // 리뷰 수정 & 포인트 기록 트랜잭션
  return prisma.$transaction([
    prisma.review.update({
      where: { reviewId },
      data: {
        content: newContent,
        photos: newPhotos
      }
    }),
    prisma.pointLog.create({ data: newPointLog })
  ])
}
