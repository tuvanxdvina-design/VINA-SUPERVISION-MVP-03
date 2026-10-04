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

## Chon model va reasoning

Mac dinh chon model nhe nhat du dat viec. Chi nang model khi co ly do ro rang trong issue, CI log hoac pham vi thay doi.

| Loai viec | Model/effort de xuat | Ghi chu |
|---|---|---|
| Doc issue, tom tat CI, sua nhan/van ban/tai lieu nho | `gpt-6-luna`, `low` | Khong quet repo rong. |
| Sua UI/JS nho, selector/test case hep, template GitHub | `gpt-6-luna`, `medium` | Doc dung file theo CODEMAP, day len CI. |
| Debug loi co log/CI do, cham 1-3 file, can lap luan nguyen nhan | `gpt-6-sol`, `medium` | Mo log cua step loi, khong doc full history. |
| Sua backend/API/quyen/DB/migration, hoac thay doi anh huong nhieu module | `gpt-6-sol`, `high` | Can doc contract, test lien quan, rui ro hoi quy. |
| Bao mat, du lieu that, release production, kien truc, yeu cau mo ho/nhieu PA | `gpt-6-astra`, `medium` hoac `high` | Dung khi chat luong quan trong hon chi phi. |
| Review code quan trong truoc khi merge/phat hanh | `gpt-6-astra`, `medium` | Tap trung bug, rui ro, test thieu. |
| Tac vu lap lai/automation/doc ket qua dat-khong dat | `gpt-6-luna`, `low` | Chi nang khi ket qua bat thuong. |

Quy tac nang model:

- Tang tu Luna len Sol khi phai sua logic, dong bo frontend-backend, doc nhieu log, hoac co loi khong tai hien duoc ngay.
- Tang tu Sol len Astra khi co rui ro bao mat/du lieu, quyet dinh kien truc, yeu cau mau thuan, hoac can review chat luong cao.
- Tang reasoning mot muc khi can lap ke hoach, so sanh PA, truy vet bug qua nhieu file, hoac sua test hoi quy.

Quy tac ha model:

- Ha ve Luna neu viec chi la doc CI, cap nhat issue, sua typo, them template, doi copy, hoac mot patch ro rang.
- Khong dung Astra cho viec chi can doc file da biet, tao issue, hoac relay ket qua CI.
- Sau khi CI xanh, phien sau chi can doc issue + `chatGPT.md` + `docs/CODEMAP.md`; khong nap lai toan bo trao doi cu.

## CI hien tai

GitHub Actions tren `main` chay: audit, syntax, security config, frontend structure, backend regression va UI Playwright.

Link Actions: https://github.com/tuvanxdvina-design/VINA-SUPERVISION-MVP-03/actions
