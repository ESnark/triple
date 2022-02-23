## Environments & Libraries
* HTTP framework: express
* Testing framework: jest
* node.js v14.19.0
* typescript v4.5.5
* Database: mysql 5.7
* ORM: Prisma
* etc: class-validator

## Installation
1. MySQL 서비스를 실행하고 .env에 DATABASE_URL을 입력합니다.
2. 프로젝트 루트의 trpl.sql을 실행합니다. (⚠️ database trpl이 자동으로 DROP 됩니다.)
3. `yarn install`
4. `yarn run prisma:generate`
5. `yarn start`

## Testing
`yarn run test`

## API Spec
> http://localhost:3000 으로 통신합니다.

### 포인트 적립 API
```
POST /events

{
  "type": "REVIEW",
  "action": "ADD" | "MOD" | "DELETE",
  "reviewId": string,
  "content": string,
  "attachedPhotoIds": string[],
  "userId": string,
  "placeId": string
}
```
> reviewId, attachedPhotoIds, userId, placeId는 uuid를 입력받습니다.

### 포인트 조회 API
```
GET /user/:userId/points?limit={number}&cursor={log_id}&sum={any}
```
* limit: 최신 정렬 기준으로 몇개의 포인트 로그를 읽어올 것인지 결정합니다. (기본값: 30, Optional)
* cursor: 포인트 로그 ID를 입력받아서 이 다음의 로그를 불러올 수 있습니다. (Optional)
* sum: 어떤 값이든 입력받는 bool flag 파라미터입니다. 이 파라미터를 입력받으면 response 데이터에 total(포인트 총합) 값이 추가됩니다. (Optional)
