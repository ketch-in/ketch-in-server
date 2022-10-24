<h1 align="center">
    <a src="https://github.com/ketch-in" alt="ketch-in">
        <img src="https://avatars.githubusercontent.com/u/102146264" width=64 />
    </a>
    <br />
    KETCH IN SERVER
</h1>

## Environment variable

| key  | type   | 설명                    |
| ---- | ------ | ----------------------- |
| PORT | number | 포트 번호를 지정합니다. |

## Socket

| key                | params             | 설명                                            |
| ------------------ | ------------------ | ----------------------------------------------- |
| extra-data-updated | extra              | RTCMultiConnection의 extra 데이터를 교환합니다. |
| check-presence     | roomId, \_callback | 해당 방이 존재하는 지 여부를 반환합니다.        |
| data-sharing       | message            | 데이터 값을 공유를 확인하고 정보를 공유합니다.  |
| open-room          | arg, \_callback    | 방을 생성합니다.                                |
| join-room          | arg, \_callback    | 방에 참여합니다.                                |
| disconnect         |                    | 방에서 나갑니다.                                |
