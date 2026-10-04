# ChatGPT Handoff

Muc tieu cua file nay la giup phien moi vao viec nhanh ma khong phai doc lai lich su hoi thoai dai.

## Quy trinh vao viec

1. Doc GitHub Issue dang duoc giao.
2. Doc file nay va `docs/CODEMAP.md`.
3. Chi mo them file lien quan truc tiep theo issue va CODEMAP.
4. Neu issue thieu buoc tai hien hoac ket qua mong muon, bo sung issue ngan gon truoc khi sua.
5. Sau khi sua, day ma len GitHub va doc ket qua CI thay vi chay lai toan bo bo test nang o local.

## Cach ghi GitHub Issue

Moi loi tach thanh mot issue rieng. Tieu de ngan gon, neu co the bat dau bang khu vuc:

- `[UI] ...`
- `[API] ...`
- `[DB] ...`
- `[CI] ...`
- `[Security] ...`

Noi dung toi thieu:

- Buoc tai hien: 3-7 buoc ngan, co tai khoan/vai tro, trang, nut bam, du lieu nhap.
- Ket qua thuc te: loi nhin thay, thong bao, console, log, hoac CI step do.
- Ket qua mong muon: hanh vi dung.
- Pham vi nghi ngo: file/module neu biet.
- Bang chung: anh, log, run link, hoac artifact neu co.

Khong gom nhieu loi doc lap vao cung mot issue. Neu mot loi keo theo viec phat hien loi khac, tao issue moi va dan link qua lai.

## Quy tac tiet kiem token

- Khong doc lai lich su chat cu khi issue da co du thong tin.
- Dung `docs/CODEMAP.md` de dinh tuyen file truoc khi `rg` toan repo.
- Uu tien doc ket qua GitHub Actions: xanh/do, job, step, log ngan cua step loi.
- Chi chay local test nang khi CI khong du thong tin hoac can lap lai nhanh mot ca hep.
- Cap nhat issue bang ket qua cuoi: commit, CI run, con rui ro nao.

## CI hien tai

GitHub Actions tren `main` chay: audit, syntax, security config, frontend structure, backend regression va UI Playwright.

Link Actions: https://github.com/tuvanxdvina-design/VINA-SUPERVISION-MVP-03/actions
