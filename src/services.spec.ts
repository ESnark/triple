import { reviewEventService, readPointLogService } from './services'
import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { v4 as uuid } from 'uuid'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime'
import createHttpError from 'http-errors'

const prisma = new PrismaClient()
type mockJson = { json: jest.Mock<any, any> }

let mockRequest: Partial<Request>
let mockResponse: Partial<Response> & mockJson
const next: NextFunction = jest.fn()
describe('시나리오 1: 단일 리뷰 생성, 수정, 삭제', () => {
  const reviewId = uuid()
  const userId = uuid()
  const placeId = uuid()
  const content = 'test'
  const attachedPhotoIds = [uuid()]

  beforeEach(() => {
    mockRequest = {}
    mockResponse = { json: jest.fn() }
  })

  describe('[ADD] 최초 리뷰 / 텍스트 포함 / 사진 포함', () => {
    test('review 테이블에 reviewId, userId, placeId가 기록되어야 함. content, photos column은 true', async () => {
      mockRequest.body = {
        type: 'REVIEW',
        action: 'ADD',
        reviewId, userId, placeId, content, attachedPhotoIds
      }
  
      await reviewEventService(mockRequest as Request, mockResponse as Response, next)
      
      const review = await prisma.review.findFirst({ where: { reviewId } })
      expect(review).toMatchObject({ reviewId, userId, placeId, content: true, photos: true })
    })
  
    test('readPointLogService의 응답값 검사. pContent(1) pPhoto(1) pFirst(1) total(3)', async () => {
      mockRequest.params = { userId }
      mockRequest.query = { sum: '1' }
      await readPointLogService(mockRequest as Request, mockResponse as Response, next)
  
      // service에서 내보낸 응답값
      const responseLog: any[] = mockResponse.json.mock.calls[0][0].logs
      // service에서 내보낸 포인트 총점
      const responseTotal: number = mockResponse.json.mock.calls[0][0].total
      
      // 조회되는 로그는 1개
      expect(responseLog.length).toEqual(1)
      expect(responseLog[0]).toMatchObject({
        reviewId,
        placeId,
        pContent: 1,
        pPhoto: 1,
        pFirst: 1,
      })

      // 총점 3점
      expect(responseTotal).toEqual(3)
    })

    test('pointLog record 검사. pContent(1) pPhoto(1) pFirst(1)', async () => {
      // DB에서 직접 조회한 로그
      const logs = await prisma.pointLog.findMany({ where: { userId }, take: 30, orderBy: { id: 'desc' } })
      expect(logs.length).toEqual(1)
      expect(logs[0]).toMatchObject({
        userId,
        placeId,
        reviewId,
        pContent: 1,
        pPhoto: 1,
        pFirst: 1,
      })
    })

    test('리뷰 중복 등록 시 throw error', async () => {
      mockRequest.body = {
        type: 'REVIEW',
        action: 'ADD',
        reviewId, userId, placeId, content, attachedPhotoIds
      }
      const eventPromise = reviewEventService(mockRequest as Request, mockResponse as Response, next)
      expect(eventPromise).rejects.toThrowError(PrismaClientKnownRequestError)
    })
  })

  describe('[MOD] 최초 리뷰에서 사진 삭제', () => {
    test('review record의 photos column이 false로 바뀌어야 함', async () => {
      mockRequest.body = {
        type: 'REVIEW',
        action: 'MOD',
        reviewId, userId, placeId, content, attachedPhotoIds: []
      }
  
      await reviewEventService(mockRequest as Request, mockResponse as Response, next)
      
      const review = await prisma.review.findFirst({ where: { reviewId } })
      expect(review).toMatchObject({ reviewId, userId, placeId, content: true, photos: false })
    })

    test('readPointLogService의 응답값 검사. pContent(0) pPhoto(-1) pFirst(0) total(2)', async () => {
      mockRequest.params = { userId }
      mockRequest.query = { sum: '1' }
      await readPointLogService(mockRequest as Request, mockResponse as Response, next)
  
      // service에서 내보낸 응답 로그
      const responseLog: any[] = mockResponse.json.mock.calls[0][0].logs
      // service에서 내보낸 포인트 총점
      const responseTotal: number = mockResponse.json.mock.calls[0][0].total
      
      // 조회되는 로그는 2개
      expect(responseLog.length).toEqual(2)
      expect(responseLog[0]).toMatchObject({
        reviewId,
        placeId,
        pContent: 0,
        pPhoto: -1,
        pFirst: 0,
      })

      // 총점 2점
      expect(responseTotal).toEqual(2)
    })

    test('pointLog record 검사. pContent(0) pPhoto(-1) pFirst(0)', async () => {
      // DB에서 직접 조회한 로그
      const logs = await prisma.pointLog.findMany({ where: { userId }, take: 30, orderBy: { id: 'desc' } })

      // 생성된 Record는 2개
      expect(logs.length).toEqual(2)
      expect(logs[0]).toMatchObject({
        userId,
        placeId,
        reviewId,
        pContent: 0,
        pPhoto: -1,
        pFirst: 0,
      })
    })

    test('변경사항이 없으면 pointLog를 추가하지 않는다.', async () => {
      mockRequest.body = {
        type: 'REVIEW',
        action: 'MOD',
        reviewId, userId, placeId, content, attachedPhotoIds: []
      }
  
      await reviewEventService(mockRequest as Request, mockResponse as Response, next)

      // 생성된 Log Record는 2개
      const logs = await prisma.pointLog.findMany({ where: { userId }, take: 30, orderBy: { id: 'desc' } })
      expect(logs.length).toEqual(2)
    })
  })
  
  describe('[DELETE] 최초 리뷰 삭제', () => {
    test('review record가 삭제되어야 함', async () => {
      mockRequest.body = {
        type: 'REVIEW',
        action: 'DELETE',
        reviewId, userId, placeId
      }
  
      await reviewEventService(mockRequest as Request, mockResponse as Response, next)
      
      const review = await prisma.review.findFirst({ where: { reviewId } })
      expect(review).toEqual(null)
    })

    test('readPointLogService의 응답값 검사. pContent(-1) pPhoto(0) pFirst(-1) total(0)', async () => {
      mockRequest.params = { userId }
      mockRequest.query = { sum: '1' }
      await readPointLogService(mockRequest as Request, mockResponse as Response, next)
  
      // service에서 내보낸 응답 로그
      const responseLog: any[] = mockResponse.json.mock.calls[0][0].logs
      // service에서 내보낸 포인트 총점
      const responseTotal: number = mockResponse.json.mock.calls[0][0].total
      
      // 조회되는 로그는 3개
      expect(responseLog.length).toEqual(3)
      expect(responseLog[0]).toMatchObject({
        reviewId,
        placeId,
        pContent: -1,
        pPhoto: 0,
        pFirst: -1,
      })

      // 총점 2점
      expect(responseTotal).toEqual(0)
    })

    test('pointLog record 검사. pContent(-1) pPhoto(0) pFirst(-1)', async () => {
      // DB에서 직접 조회한 로그
      const logs = await prisma.pointLog.findMany({ where: { userId }, take: 30, orderBy: { id: 'desc' } })

      // 생성된 Record는 3개
      expect(logs.length).toEqual(3)
      expect(logs[0]).toMatchObject({
        userId,
        placeId,
        reviewId,
        pContent: -1,
        pPhoto: 0,
        pFirst: -1,
      })
    })
  })
})

describe('시나리오 2: 리뷰 2개 생성, 삭제', () => {
  const placeId = uuid()
  const reviewId1 = uuid()
  const reviewId2 = uuid()
  const userId1 = uuid()
  const userId2 = uuid()

  beforeEach(() => {
    mockRequest = {}
    mockResponse = { json: jest.fn() }
  })

  describe('[ADD][유저 A] 최초 리뷰 / 텍스트 포함 / 사진 미포함', () => {
    test('review 테이블에 reviewId, userId, placeId가 기록되어야 함. content(true) photos(false)', async () => {
      mockRequest.body = {
        type: 'REVIEW',
        action: 'ADD',
        reviewId: reviewId1, userId: userId1, placeId, content: 'test', attachedPhotoIds: []
      }
  
      await reviewEventService(mockRequest as Request, mockResponse as Response, next)
      
      const review = await prisma.review.findFirst({ where: { reviewId: reviewId1 } })
      expect(review).toMatchObject({ reviewId: reviewId1, userId: userId1, placeId, content: true, photos: false })
    })

    test('readPointLogService의 응답값 검사. pContent(1) pPhoto(0) pFirst(1) total(2)', async () => {
      mockRequest.params = { userId: userId1 }
      mockRequest.query = { sum: '1' }
      await readPointLogService(mockRequest as Request, mockResponse as Response, next)
  
      // service에서 내보낸 응답값
      const responseLog: any[] = mockResponse.json.mock.calls[0][0].logs
      // service에서 내보낸 포인트 총점
      const responseTotal: number = mockResponse.json.mock.calls[0][0].total
      
      // 조회되는 로그는 1개
      expect(responseLog.length).toEqual(1)
      expect(responseLog[0]).toMatchObject({
        reviewId: reviewId1,
        placeId: placeId,
        pContent: 1,
        pPhoto: 0,
        pFirst: 1,
      })

      // 총점 2점
      expect(responseTotal).toEqual(2)
    })

    test('pointLog record 검사. pContent(1) pPhoto(0) pFirst(1)', async () => {
      // DB에서 직접 조회한 로그
      const logs = await prisma.pointLog.findMany({ where: { userId: userId1 }, take: 30, orderBy: { id: 'desc' } })

      // 생성된 로그는 1개
      expect(logs.length).toEqual(1)
      expect(logs[0]).toMatchObject({
        userId: userId1,
        placeId,
        reviewId: reviewId1,
        pContent: 1,
        pPhoto: 0,
        pFirst: 1,
      })
    })
  })

  describe('[ADD][유저 B] 최초 리뷰 X / 텍스트 포함 / 사진 미포함', () => {
    test('review 테이블에 reviewId, userId, placeId가 기록되어야 함. content(true) photos(false)', async () => {
      mockRequest.body = {
        type: 'REVIEW',
        action: 'ADD',
        reviewId: reviewId2, userId: userId2, placeId, content: 'test', attachedPhotoIds: []
      }
  
      await reviewEventService(mockRequest as Request, mockResponse as Response, next)
      
      const review = await prisma.review.findFirst({ where: { reviewId: reviewId1 } })
      expect(review).toMatchObject({ reviewId: reviewId1, userId: userId1, placeId, content: true, photos: false })
    })

    test('readPointLogService의 응답값 검사. pContent(1) pPhoto(0) pFirst(0) total(1)', async () => {
      mockRequest.params = { userId: userId2 }
      mockRequest.query = { sum: '1' }
      await readPointLogService(mockRequest as Request, mockResponse as Response, next)
  
      // service에서 내보낸 응답값
      const responseLog: any[] = mockResponse.json.mock.calls[0][0].logs
      // service에서 내보낸 포인트 총점
      const responseTotal: number = mockResponse.json.mock.calls[0][0].total
      
      // 조회되는 로그는 1개
      expect(responseLog.length).toEqual(1)
      expect(responseLog[0]).toMatchObject({
        reviewId: reviewId2,
        placeId: placeId,
        pContent: 1,
        pPhoto: 0,
        pFirst: 0,
      })

      // 총점 1점
      expect(responseTotal).toEqual(1)
    })

    test('pointLog record 검사. pContent(1) pPhoto(0) pFirst(0)', async () => {
      // DB에서 직접 조회한 로그
      const logs = await prisma.pointLog.findMany({ where: { userId: userId2 }, take: 30, orderBy: { id: 'desc' } })

      // 생성된 로그는 1개
      expect(logs.length).toEqual(1)
      expect(logs[0]).toMatchObject({
        userId: userId2,
        placeId,
        reviewId: reviewId2,
        pContent: 1,
        pPhoto: 0,
        pFirst: 0,
      })
    })
  })
  
  describe('[DELETE] 최초 리뷰 삭제 후 유저 A, B 포인트 검사', () => {
    test('review record가 삭제되어야 함', async () => {
      mockRequest.body = {
        type: 'REVIEW',
        action: 'DELETE',
        reviewId: reviewId1, userId: userId1, placeId
      }
  
      await reviewEventService(mockRequest as Request, mockResponse as Response, next)
      
      const review = await prisma.review.findFirst({ where: { reviewId: reviewId1 } })
      expect(review).toEqual(null)
    })

    test('User A의 포인트 총점은 0이어야 함', async () => {
      mockRequest.params = { userId: userId1 }
      mockRequest.query = { sum: '1' }
      await readPointLogService(mockRequest as Request, mockResponse as Response, next)
  
      // service에서 내보낸 포인트 총점
      const responseTotal: number = mockResponse.json.mock.calls[0][0].total
      
      // 총점 0점
      expect(responseTotal).toEqual(0)
    })

    test('User B의 포인트 총점은 1이어야 함', async () => {
      mockRequest.params = { userId: userId2 }
      mockRequest.query = { sum: '1' }
      await readPointLogService(mockRequest as Request, mockResponse as Response, next)

      // service에서 내보낸 포인트 총점
      const responseTotal: number = mockResponse.json.mock.calls[0][0].total

      // 총점 1점
      expect(responseTotal).toEqual(1)
    })
  })
})

describe('시나리오 3: 포인트 로그 30개 생성 후 pagination 조회', () => {
  const reviewId = uuid()
  const userId = uuid()
  const placeId = uuid()
  const content = 'test'
  const attachedPhotoIds = [uuid()]
  let cursor: string

  beforeEach(() => {
    mockRequest = {}
    mockResponse = { json: jest.fn() }
  })
  
  test('리뷰 작성', async () => {
    mockRequest.body = {
        type: 'REVIEW',
        action: 'ADD',
        reviewId, userId, placeId, content, attachedPhotoIds: []
    }

    await reviewEventService(mockRequest as Request, mockResponse as Response, next)
    
    const review = await prisma.review.findFirst({ where: { reviewId } })
    expect(review).toBeDefined()
  })

  test('리뷰 반복 수정', async () => {
    const addPhoto = {
      type: 'REVIEW',
      action: 'MOD',
      reviewId, userId, placeId, content, attachedPhotoIds
    }
    const removePhoto = {
      type: 'REVIEW',
      action: 'MOD',
      reviewId, userId, placeId, content, attachedPhotoIds: []
    }

    for (let i = 0; i < 29; i++) {
      mockRequest.body = i % 2 === 0 ? addPhoto : removePhoto
      await reviewEventService(mockRequest as Request, mockResponse as Response, next)
      mockResponse.json = jest.fn()
    }
  })

  test('최근 10개 리뷰 로그 조회', async () => {
    mockRequest.params = { userId }
    mockRequest.query = { limit: '10' }
    await readPointLogService(mockRequest as Request, mockResponse as Response, next)
    const { logs } = mockResponse.json.mock.calls[0][0]
    expect(logs?.length).toEqual(10)
    
    cursor = '' + logs[9].id
  })

  test('다음 10개 리뷰 로그 조회', async () => {
    mockRequest.params = { userId }
    mockRequest.query = { limit: '10', cursor }
    await readPointLogService(mockRequest as Request, mockResponse as Response, next)
    const { logs } = mockResponse.json.mock.calls[0][0]
    expect(logs?.length).toEqual(10)
    
    cursor = '' + logs[9].id
  })

  test('마지막 10개 리뷰 로그 조회', async () => {
    mockRequest.params = { userId }
    mockRequest.query = { limit: '10', cursor }
    await readPointLogService(mockRequest as Request, mockResponse as Response, next)
    const { logs } = mockResponse.json.mock.calls[0][0]
    expect(logs?.length).toEqual(10)
    
    // 최초 리뷰 포인트 로그
    expect(logs[9]).toMatchObject({ pContent: 1, pPhoto: 0, pFirst: 1 })
  })
})
