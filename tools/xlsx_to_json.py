"""data/words.xlsx → data/words.json 변환.

사용: python tools/xlsx_to_json.py
엑셀에서 제시어를 고치거나 추가한 뒤 다시 실행하면 된다. 각 시트의 5행이 머리글, 6행부터 데이터.
"""
import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "words.xlsx"
DST = ROOT / "data" / "words.json"
LEVELS = ("쉬움", "보통", "어려움")


def rows(ws):
    for r in ws.iter_rows(min_row=6, values_only=True):
        if r[0] is None or r[2] is None:
            continue
        yield [str(v).strip() if isinstance(v, str) else v for v in r]


def sheet(wb, prefix):
    # 시트 이름 끝의 개수(_100 등)는 제시어를 늘리면 바뀌니 앞부분으로 찾는다
    return next(ws for ws in wb if ws.title.startswith(prefix))


def check_level(word, level):
    if level not in LEVELS:
        sys.exit(f"난이도 오류: {word!r} → {level!r} (쉬움/보통/어려움 중 하나)")


def main():
    wb = openpyxl.load_workbook(SRC, data_only=False)

    body = []
    for no, cat, word, level, _status, judge, *_ in rows(sheet(wb, "몸으로말해요")):
        check_level(word, level)
        body.append({"id": f"b{no}", "cat": cat, "word": word, "level": level, "judge": judge or ""})

    same = []
    for no, cat, word, *_chars, level, _status, _url in rows(sheet(wb, "이구동성")):
        check_level(word, level)
        # 첫째~넷째 열은 =MID() 수식이라 값 대신 정답에서 직접 나눈다
        chars = list(word.replace(" ", ""))
        if len(chars) != 4:
            sys.exit(f"이구동성 제시어는 네 글자여야 함: {word!r}")
        same.append({"id": f"s{no}", "cat": cat, "word": word, "chars": chars, "level": level})

    english = []
    for no, cat, word, level, _status, hint, aired, *_ in rows(sheet(wb, "영어로설명하기")):
        check_level(word, level)
        english.append({"id": f"e{no}", "cat": cat, "word": word, "level": level,
                        "hint": hint or "", "aired": "실제 제시어" in (aired or "")})

    for name, items in (("몸으로 말해요", body), ("이구동성", same), ("영어로 설명하기", english)):
        ids = [x["id"] for x in items]
        if len(ids) != len(set(ids)):
            sys.exit(f"{name}: 번호 중복")

    # 제시어 하나당 한 줄 → 엑셀을 고친 뒤 git diff 로 바뀐 줄만 보인다
    games = {"body": body, "same": same, "english": english}
    parts = []
    for key, items in games.items():
        lines = ",\n".join("  " + json.dumps(x, ensure_ascii=False) for x in items)
        parts.append(f' "{key}": [\n{lines}\n ]')
    DST.write_text("{\n" + ",\n".join(parts) + "\n}\n", encoding="utf-8")
    print(f"{DST.name}: 몸으로 말해요 {len(body)} · 이구동성 {len(same)} · 영어로 설명하기 {len(english)}")


if __name__ == "__main__":
    main()
