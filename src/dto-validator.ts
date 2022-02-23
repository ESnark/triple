import { IsString, IsUUID, validateOrReject } from 'class-validator'
import { Request, Response, NextFunction } from 'express'

type ActionType = 'ADD' | 'MOD' | 'DELETE'

interface IEventsDTO {
  type: string
  action: ActionType
  reviewId: string
  content?: string
  attachedPhotoIds?: string[]
  userId: string
  placeId: string
}

/**
 * POST /events 엔드포인트로 들어오는 body 정보를 입력받는다.
 */
export class EventsDTO implements IEventsDTO {
  constructor(obj: IEventsDTO) {
    const { type, action, reviewId, content, attachedPhotoIds, userId, placeId } = obj

    this.type = type
    this.action = action
    this.reviewId = reviewId
    this.content = content || ''
    this.attachedPhotoIds = attachedPhotoIds || []
    this.userId = userId
    this.placeId = placeId
  }
  
  @IsString()
  type: string

  @IsString()
  action: ActionType

  @IsUUID()
  reviewId: string

  @IsString()
  content: string

  @IsUUID(undefined, { each: true })
  attachedPhotoIds: string[]

  @IsUUID()
  userId: string

  @IsUUID()
  placeId: string

  /** 리뷰 텍스트 유무 */
  get contentValid() {
    return this.content.length > 0
  }

  /** 리뷰 이미지 유무 */
  get photosValid() {
    return this.attachedPhotoIds.length > 0
  }
}

export const EventsDTOValidator = (req: Request, res: Response, next: NextFunction) => {
  const body = req.body as IEventsDTO
  const eventData = new EventsDTO(body)
  validateOrReject(eventData).then(() => next()).catch(next)
}
