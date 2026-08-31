# Аппаратная платформа и закупка

**Дата ценового среза:** 2026-08-30. **Регион и валюта:** Россия, RUB, цены с НДС.
Документ является инженерной спецификацией, а не коммерческим предложением. Метка
`текущий листинг` применяется только к доступной публичной карточке с ценой; `листинг без
наличия` — к карточке, где товар нельзя заказать; `оценка` — к плановой цене без
проверенного публичного наличия. В таблицах ниже все цены — **оценки**, если явно не сказано
обратное. Перед оплатой обязательны два КП с точным P/N, ревизией, сроком, гарантией и НДС.

## 1. Вывод для закупки

Основная ветка — два одинаковых односокетных узла по 16 физических ядер: AMD EPYC 4564P,
128 ГБ ECC DDR5 UDIMM, серверная AM5-плата с BMC/IPMI и двумя 10GbE, два enterprise SATA
SSD 1,92 ТБ с PLP в RAID1. Расчётный полный стартовый комплект — **966 000 ₽**, то есть
на 34 000 ₽ ниже лимита 1 млн ₽. Это бюджетная цель, а не подтверждённая цена: если КП
превысит лимит, сначала исключается запасной SSD и уменьшается UPS, но не ECC, BMC, PLP,
RAID1 или второй узел.

Два узла совместно являются кандидатом на 300–500 HTTP RPS. После отказа одного узла
планируется деградированный режим около 250–300 RPS, а не гарантированные 500 RPS.
Покупка допустима только после прикладного benchmark. Для 500 RPS при отказе показан
отдельный дорогой класс D: 24–32 физических ядра **на каждом** сервере.

GPU сейчас не закупается: внешний LLM API и CPU-hashing embeddings его не требуют.

## 2. Проверенные платформы и совместимость

### 2.1 Новая основная платформа AM5

| Узел проверки | Подтверждённый результат | Официальный источник |
|---|---|---|
| CPU | EPYC 4564P: Zen 4, 1P/AM5, 16C/32T, 4,5/5,7 ГГц, 170 W, DDR5-5200, 2 канала, PCIe 5.0 x28 | [AMD 4564P](https://www.amd.com/en/products/processors/server/epyc/4004-series/amd-epyc-4564p.html) |
| CPU minimum | EPYC 4464P: 12C/24T, AM5, DDR5 ECC-capable platform, 65 W | [AMD 4464P](https://www.amd.com/en/products/processors/server/epyc/4004-series/amd-epyc-4464p.html) |
| CPU reserve | EPYC 4584PX: 16C/32T, 128 МБ L3, AM5, 120 W | [AMD 4584PX](https://www.amd.com/en/products/processors/server/epyc/4004-series/amd-epyc-4584px.html) |
| Плата | ASRock Rack B650D4U3-2L2Q: micro-ATX, AM5/B650, 4 DDR5 ECC UDIMM, BMC/IPMI, 2x10GbE + 2x1GbE, PCIe 5.0 x16, 8 SATA, 2 M.2 | [страница и manual/QVL платы](https://www.asrockrack.com/general/productdetail.asp?Model=B650D4U3-2L2Q) |
| CPU ↔ плата | EPYC 4004 допустим только при наличии конкретного CPU и требуемой версии BIOS в официальном CPU Support List платы | [ASRock Rack CPU support](https://www.asrockrack.com/support/cpu.asp) |
| RAM | 32 ГБ DDR5-4800/5200 ECC UDIMM; 4 модуля = 128 ГБ, оба канала заполнены, 0 свободных слотов; максимум платы проверяется по текущему manual/QVL | [ASRock Rack memory QVL](https://www.asrockrack.com/support/SupportList.asp?cat=Memory) |
| SSD | Samsung PM893: enterprise TLC SATA 6G, 2,5", PLP, 1 DWPD/5 лет; 1,92 ТБ даёт 3,504 ПБ расчётной записи | [Samsung PM893](https://semiconductor.samsung.com/ssd/datacenter-ssd/pm893/) |
| NIC | Встроенные 10GbE платы используются без отдельной карты; запасной класс — Intel X550-T2, PCIe 3.0 x4, 2x10GBASE-T | [Intel X550 brief](https://www.intel.com/content/dam/www/public/us/en/documents/product-briefs/ethernet-x550-brief.pdf) |

**QVL-гейт:** совпадение AM5/DDR5 недостаточно. В заказ попадает только память, чей полный
P/N есть в Memory QVL конкретной ревизии платы, и только CPU из CPU Support List при
зафиксированной версии BIOS. Если поставщик не подтверждает это письменно, позиция остаётся
классом `32 ГБ ECC DDR5 UDIMM`, а не совместимой моделью. RDIMM/LRDIMM и non-ECC DIMM для
этой ветки запрещены. Четыре DIMM дают 128 ГБ, но исчерпывают слоты; переход к 256 ГБ может
потребовать замены всех четырёх модулей.

### 2.2 Альтернативы и предел утверждения

| Ветка | Что официально подтверждается | Решение |
|---|---|---|
| Intel Xeon E-2400 | 1P LGA1700, ECC UDIMM и до 8 производительных ядер; характеристики конкретного E-2488 | [Intel ARK E-2488](https://www.intel.com/content/www/us/en/products/sku/236191/intel-xeon-e2488-processor-24m-cache-3-20-ghz/specifications.html) | Допустим для A-min, но не замена 16-ядерному B без benchmark; плата и RAM только из её QVL. |
| Dell PowerEdge R7525 refurbished | 2U, AMD EPYC 7002/7003, 32 DIMM slots, PCIe Gen4, hot-swap и redundant PSU | [Dell technical guide](https://www.dell.com/support/manuals/en-us/poweredge-r7525/per7525_ts_pub/) | Только refurbished-ветка с EPYC 7002/7003 и как цельная OEM-конфигурация по Service Tag; **не** host для EPYC 9224. |
| HPE ProLiant DL385 Gen10 Plus refurbished | 2U, EPYC 7002/7003, 32 DIMM slots, iLO, redundant hot-plug PSU | [HPE QuickSpecs](https://www.hpe.com/psnow/doc/a00073551enw) | То же: только CTO/QuickSpecs option P/N и проверка iLO/Smart Array/drive caddy. |
| SP5/EPYC 9004 для D-tier | CPU EPYC 9224/9354P имеет socket SP5, но совместимый server host этим не доказывается | [AMD EPYC 9004](https://www.amd.com/en/products/processors/server/epyc/4th-generation-9004-and-8004-series.html) | **Host не выбран и не оценён:** нужен официальный OEM CTO/configurator output с CPU, BIOS, DIMM, riser, NIC, NVMe backplane, cooling и PSU P/N. |

Не подтверждены и поэтому не специфицируются как совместимые конкретные cooler, chassis и
PSU для платы ASRock Rack: поставщик обязан дать сборочный лист с проверкой высоты кулера,
micro-ATX standoff, airflow при 170 W, кабелей EPS и SATA, 8 hot-swap bays и PSU. Требуемый
класс: 2U/4U или tower, 8x2,5", front-to-back airflow, redundant 80 Plus Platinum 2x800 W
либо одиночный 750 W для бюджетной tower-сборки. Это явный caveat, не скрытая совместимость.

## 3. Единые профили компонентов

В таблице 12 конфигураций используются следующие коды; код раскрывает все обязательные
поля, а количество узлов указано отдельно.

| Код | CPU и причина | RAM / board | Storage | Network / chassis / power / UPS / room |
|---|---|---|---|---|
| `N12-64` | EPYC 4464P, 1S, 12C/24T, base/boost 3,7/5,4 ГГц, TDP 65 W; причина: минимальный CPU с 12 физическими cores при низком power | 2x32 ГБ ECC DDR5-4800/5200 UDIMM, 2 channels, 2 free/4 slots, platform max 192 ГБ (4x48; повторная сверка current manual/QVL); B650D4U3-2L2Q, AM5/B650, PCIe 5.0 x16, BMC/IPMI, 2x10GbE+2x1GbE | 2xPM893 1,92 ТБ, SATA 6G, enterprise TLC, 1 DWPD/5 лет, PLP, RAID1; raw 3,84/usable 1,92 ТБ, reserve/free target 30%=0,58 ТБ, data ceiling 1,34 ТБ; 4+ hot-swap bays | onboard 2x10GbE + 1GbE BMC, managed 8x10GbE switch; tower/4U, ≥4 bays, front-to-back airflow, 750 W; GPU нет; idle/normal/peak 75/150/260 W = 256/512/887 BTU/h; UPS 1500 VA/900 W, assumed 10 min at ≤40% load, runtime chart/battery test required; room 18–27 °C, grounded dedicated circuit |
| `N16-128` | EPYC 4564P, 1S, 16C/32T, base/boost 4,5/5,7 ГГц, TDP 170 W; причина: 16 cores/node для совместных 300–500 RPS | 4x32 ГБ ECC DDR5-5200 UDIMM exact QVL, 2 channels, 0 free/4 slots; platform max 192 ГБ (4x48), upgrade требует замены DIMM; та же B650/AM5 board, PCIe5 x16, BMC/IPMI, 2x10+2x1GbE | 2xPM893 1,92 ТБ SATA 6G TLC, 1 DWPD/5 лет, PLP, RAID1; raw 3,84/usable 1,92, free target 0,58, data ceiling 1,34 ТБ; 8 hot-swap bays | onboard 2x10GbE + BMC, managed ≥8x10GbE; tower/4U, 8 bays, front-to-back, 750 W; GPU нет; 90/220/390 W = 307/751/1 331 BTU/h; UPS 2200 VA/1980 W, assumed 10 min at total ≤50%, manufacturer chart/test required; same room |
| `N16-192` | EPYC 4584PX, 1S, 16C/32T, base/boost 4,2/5,7 ГГц, TDP 120 W; причина: cache/RAM/storage reserve, не больше cores | 4x48 ГБ ECC DDR5 UDIMM **только после exact QVL**, 2 channels, 0 free/4 slots, platform max 192 ГБ; та же B650 board/PCIe5/BMC/NIC | 4xPM893 1,92 ТБ SATA TLC 1 DWPD PLP, RAID10; raw 7,68/usable 3,84, free target 1,15, data ceiling 2,69 ТБ; 8 hot-swap | onboard 2x10GbE+BMC, ≥12x10GbE switch; 4U, 8 bays, front-to-back, redundant 2x800 W; GPU нет; 110/280/500 W = 375/955/1 706 BTU/h; UPS 2200 VA per two nodes only if measured ≤50%, 10 min assumed; same room |
| `D24-256` | EPYC 9224, 1S, 24C/48T, base/boost 2,5/3,7 ГГц, TDP 200 W; причина: минимум 24 physical cores/node для 500 RPS N-1 candidate | 8x32 ГБ ECC DDR5 RDIMM, target 4800 MT/s, 8/12 channels populated; free slots/platform max **pending exact OEM CTO**; board/chipset/PCIe5/BMC/NIC **unselected pending official CTO**, no compatible host asserted | 4x enterprise NVMe 3,84 ТБ, TLC, ≥1 DWPD, PLP, RAID10; raw 15,36/usable 7,68, free target 2,30, data ceiling 5,38 ТБ; hot-swap backplane pending CTO | target dual 25GbE+BMC, managed 25GbE switch; target 2U, ≥8 bays, front-to-back, redundant 2x1100 W; GPU нет; planning 150/450/750 W = 512/1 535/2 559 BTU/h; UPS ≥3000 VA per feed, assumed 10 min at ≤50%, exact runtime pending host/quote; room 18–27 °C, redundant circuits |
| `D32-512` | EPYC 9354P, 1S, 32C/64T, base/boost 3,25/3,8 ГГц, TDP 280 W; причина: 32 physical cores/node для полного CPU reserve | 8x64 ГБ ECC DDR5 RDIMM, target 4800 MT/s, 8/12 channels; free slots/max **pending CTO**; board/chipset/PCIe5/BMC/NIC **unselected pending official CTO** | 6x enterprise NVMe 3,84 ТБ TLC ≥1 DWPD PLP, RAID10; raw 23,04/usable 11,52, free target 3,46, data ceiling 8,06 ТБ; hot-swap pending CTO | target dual 25GbE+BMC, redundant 25GbE switches; target 2U/4U, ≥8 bays, front-to-back, 2x1400 W; GPU-ready, none now; planning 180/600/950 W = 614/2 047/3 241 BTU/h; UPS ≥5000 VA per feed, assumed 10 min at ≤50%, exact runtime pending quote; same redundant-room requirements |

Частоты 4464P/4584PX и EPYC 9004 должны быть повторно сверены в заказном datasheet: [AMD
EPYC 4004](https://www.amd.com/en/products/processors/server/epyc/4004-series.html), [AMD
9224](https://www.amd.com/en/products/processors/server/epyc/4th-generation-9004-and-8004-series/amd-epyc-9224.html),
[AMD 9354P](https://www.amd.com/en/products/processors/server/epyc/4th-generation-9004-and-8004-series/amd-epyc-9354p.html).
Для RAID ёмкость дана до файловой системы; usable ОС будет ниже из-за форматирования и
over-provisioning. Backup никогда не входит в эти usable значения.

## 4. Двенадцать конфигураций A/B/C/D

| Сценарий | Уровень | Узлы и полный профиль | Backup / switch / UPS | Назначение и ограничение | CAPEX, оценка |
|---|---|---|---|---|---:|
| A: один сервер MVP | min | 1x`N12-64` | внешний encrypted backup 4 ТБ; существующий 1GbE; UPS 1500 VA/900 W, 10–15 мин | dev/pilot; нет HA | 270 000 ₽ |
| A | recommended | 1x`N16-128` | backup 8 ТБ; 10GbE switch; UPS 2200 VA/1 980 W | production только с принятым SPOF | 445 000 ₽ |
| A | reserve | 1x`N16-192` | backup 12 ТБ; 10GbE switch; UPS 2200 VA | больше RAM/storage, но всё ещё SPOF | 640 000 ₽ |
| B: два сервера | min | 2x`N12-64` | backup 8 ТБ; 8x10GbE; UPS 2200 VA | HA-кандидат, 24 cores total | 706 000 ₽ |
| **B** | **recommended** | **2x`N16-128`** | **backup 8 ТБ; 8x10GbE; UPS 2200 VA** | **основная ветка; 32 cores total, failover 250–300 RPS** | **966 000 ₽** |
| B | reserve | 2x`N16-192` | backup 16 ТБ; 12x10GbE; 2xUPS 2200 VA | запас RAM/I/O, CPU всё ещё 16C/node | 1 490 000 ₽ |
| C: три сервера | min | 3x`N12-64` | backup 12 ТБ; 12x10GbE; 2xUPS 2200 VA | quorum/witness и N+1 stateless | 1 080 000 ₽ |
| C | recommended | 3x`N16-128` | backup 16 ТБ; 12x10GbE; 2xUPS 3000 VA | проще обслуживание без остановки | 1 495 000 ₽ |
| C | reserve | 3x`N16-192` | backup 24 ТБ; 16x10GbE; 3xUPS 2200 VA | storage/RAM reserve | 2 250 000 ₽ |
| D: 500 RPS при N-1 | min | 2x`D24-256` | backup 24 ТБ; 25GbE switch; 2xUPS ≥3000 VA | 24 cores/node, benchmark gate | **не оценено: exact OEM CTO/КП отсутствует** |
| D | recommended | 2x`D32-512` | backup 32 ТБ; redundant 25GbE; 2xUPS ≥5000 VA | 32 cores/node; полный CPU-запас | **не оценено: exact OEM CTO/КП отсутствует** |
| D | reserve | 3x`D32-512` | backup 48 ТБ; 2x25GbE switches; 3xUPS ≥5000 VA | N+1 и обслуживание | **не оценено: exact OEM CTO/КП отсутствует** |

Все 12 строк наследуют без исключений все поля названного профиля; отличающиеся количество
узлов, switch, backup и UPS приведены непосредственно в строке. D-tier остаётся requirement
profile, а не совместимой или оценённой сборкой, пока официальный OEM CTO не закроет поля.
Значения idle/normal/peak — инженерные оценки для sizing, а не измерения. Тепловыделение при
peak: `W × 3,412`; B-recommended = 780 W серверов = **2 661 BTU/h**, с сетью/backup и 25%
запасом проектировать не менее **4 000 BTU/h** отвода тепла. Помещение: 18–27 °C, контроль
пыли/влажности, заземление, отдельная линия, физический доступ по списку.

## 5. Основной BOM до 1 млн ₽

| Позиция | P/N или закупочный класс | Кол-во | Цена/шт | Сумма | Статус цены и URL |
|---|---|---:|---:|---:|---|
| CPU | AMD EPYC 4564P `100-100001476WOF` | 2 | 92 000 | 184 000 | **оценка**, РФ/RUB/2026-08-30; [официальный MSRP/spec](https://www.amd.com/en/products/processors/server/epyc/4004-series/amd-epyc-4564p.html), не российский листинг |
| Motherboard | ASRock Rack B650D4U3-2L2Q | 2 | 92 000 | 184 000 | **оценка**, РФ/RUB/2026-08-30; [manufacturer](https://www.asrockrack.com/general/productdetail.asp?Model=B650D4U3-2L2Q), КП обязательно |
| RAM | 32 ГБ ECC DDR5 UDIMM, exact P/N из QVL | 8 | 15 000 | 120 000 | **оценка**, РФ/RUB/2026-08-30; [QVL](https://www.asrockrack.com/support/SupportList.asp?cat=Memory), модели до QVL-гейта нет |
| Data SSD | Samsung PM893 1,92 ТБ, exact regional P/N в КП | 4 | 34 000 | 136 000 | **оценка**, РФ/RUB/2026-08-30; [Samsung](https://semiconductor.samsung.com/ssd/datacenter-ssd/pm893/), наличие не подтверждено |
| Chassis/PSU/cooler | 4U/tower, 8 bays, 750 W, AM5 170 W airflow | 2 | 52 000 | 104 000 | **оценка**, РФ/RUB/2026-08-30; совместимую сборку подтверждает поставщик |
| Switch | управляемый 8x10GbE SFP+/RJ45 class | 1 | 72 000 | 72 000 | **оценка**, РФ/RUB/2026-08-30; [MikroTik CRS312-4C+8XG-RM](https://mikrotik.com/product/crs312_4c_8xg_rm) как допустимый класс |
| Кабели/оптика | DAC/SFP+/Cat6A по выбранному switch/NIC | 4 | 5 000 | 20 000 | **оценка**, совместимость transceiver подтвердить в КП |
| UPS | 2200 VA, ≥1 800 W, SNMP-ready | 1 | 96 000 | 96 000 | **оценка**, РФ/RUB/2026-08-30; [APC SMT2200IC 2200 VA/1980 W](https://www.apc.com/us/en/product/SMT2200IC/) как класс |
| Offsite backup | encrypted 8 ТБ usable, отдельное устройство/площадка | 1 | 50 000 | 50 000 | **оценка**, адрес и носитель не определены |
| **Итого** |  |  |  | **966 000** | `184+184+120+136+104+72+20+96+50=966` тыс. ₽ |

В этом срезе нет ни одной позиции, которую удалось доказательно классифицировать как
`текущий листинг` или `листинг без наличия`; поэтому такие метки не присвоены. URL
производителя подтверждает характеристику, но **не** российскую цену или наличие. Самые
дорогие группы: CPU+platform 368 тыс., RAM 120 тыс., SSD 136 тыс. ₽. Резерв бюджета 3,4%
мал, поэтому закупочный лимит считается достигнутым только по подписанному КП.

## 6. Refurbished-ветка

| Позиция | Кол-во | Сумма | Статус |
|---|---:|---:|---|
| Dell PowerEdge R7525, 2x EPYC 7302 (всего 32C/64T), 256 ГБ ECC RDIMM, HBA/RAID, 2xPSU, iDRAC Enterprise | 2 | 440 000 ₽ | **оценка**, РФ/RUB/2026-08-30; [официальная платформа](https://www.dell.com/support/manuals/en-us/poweredge-r7525/per7525_ts_pub/), публичное наличие не подтверждено |
| 4x Samsung PM893 1,92 ТБ на сервер (8 total), новые, RAID10 | 8 | 272 000 ₽ | **оценка**; raw на узел 7,68 ТБ, usable 3,84 ТБ, target 2,69 ТБ |
| 10/25GbE NIC/кабели/switch | комплект | 92 000 ₽ | **оценка**; точный Dell option P/N по Service Tag |
| UPS 2200 VA/1980 W | 1 | 96 000 ₽ | **оценка**; runtime измерить, для двух серверов ожидается лишь корректное завершение |
| Offsite backup 8 ТБ usable | 1 | 50 000 ₽ | **оценка** |
| Диагностика, rails/caddies, 12 мес. warranty reserve | комплект | 45 000 ₽ | **оценка** |
| **Итого** |  | **995 000 ₽** | `440+272+92+96+50+45=995` тыс. ₽ |

Refurbished-ветка **неверифицируема до получения Service Tags и КП**; её 995 000 ₽ — только
budget estimate, не воспроизводимая рыночная цена. Если Service Tags/официальные build sheets
не получены, ветка исключается из закупки. Она укладывается в лимит только на бумаге и имеет
0,5% запаса. Обязательны Service
Tag, отсутствие пароля BIOS/iDRAC, Dell diagnostics, SMART/media wear, battery state RAID,
одинаковые CPU stepping, все caddies/rails, redundant PSU, burn-in 48 часов и письменная
гарантия. Диски для DB покупаются новыми; бывшие в употреблении SSD не принимаются без
остаточного ресурса ≥90% и цены, оправдывающей риск. Альтернатива HPE допустима только по
QuickSpecs/serial build sheet, без переноса Dell-компонентов.

## 7. Storage, сеть и UPS

- На каждом основном узле RAID1 состоит только из двух одинаковых PM893: raw 3,84 ТБ,
  usable 1,92 ТБ до filesystem, рабочая цель 1,34 ТБ. RAID не является backup.
- DB/index/temp/logs разделяются логическими volumes и лимитами I/O; files реплицируются
  между узлами, backup — на третью площадку. При росте сначала добавляются ещё два SSD и
  переход к RAID10 после проверенного backup/restore.
- Межузловая репликация и backup идут по отдельным VLAN; management BMC — отдельный VLAN
  без Internet; минимум два 10GbE порта на узел. Публичный канал: старт 1 Гбит/с, 95th
  percentile и egress измеряются; месячный трафик нельзя вычислить без среднего payload.
- Switch должен иметь ≥8 10GbE ports, VLAN, LACP, SNMP, запас ≥2 ports. Один switch остаётся
  SPOF; D-recommended требует двух switches и dual-homing.
- B-recommended peak: servers 2x390 + switch 60 + backup 40 = 880 W. UPS 1980 W загружен на
  44%; требуемое время 10 минут проверяется по runtime chart с возрастным запасом батареи.
  UPS питает корректное завершение, не часовую работу. Для A-min допустим 1500 VA/900 W;
  для D — отдельный UPS на каждый PSU feed.

**Метод мощности и UPS.** Idle/normal/peak — planning estimates всего узла от розетки:
CPU TDP не равен wall power; к CPU добавлены RAM, board/BMC, SSD/NIC/fans, потери PSU и 20%
transient reserve. BTU/h = W × 3,412. UPS load = сумма server peak + switch + backup, без
двойного счёта номинала redundant PSU; запас по W ≥25%, целевая загрузка ≤50%. Указанные 10
минут — assumption для sizing, а не характеристика батареи: финальное время берётся из
официальной runtime curve при расчётной нагрузке, затем уменьшается на 20% aging/temperature
reserve и подтверждается discharge test на площадке. VA выбирается только вместе с W и power
factor. Для D значения нельзя финализировать до exact CTO и measured wall power.

## 8. Условные GPU-ветки, не текущая закупка

| Вариант | Модель/класс | VRAM / precision и практический предел | PCIe / power / cooling | Ожидаемое применение |
|---|---|---|---|---|
| 2A | NVIDIA L4 | 24 ГБ GDDR6 ECC; embeddings/OCR/reranker FP16/BF16/INT8, небольшие 7–8B LLM INT4 | PCIe Gen4 x16, 72 W, low-profile passive; нужен server airflow | 1–8 concurrent sequences после benchmark; [NVIDIA L4](https://www.nvidia.com/en-us/data-center/l4/) |
| 2B | NVIDIA RTX 6000 Ada | 48 ГБ GDDR6 ECC; 7–14B FP16/INT8, 32B INT4 с запасом на KV cache | PCIe Gen4 x16, dual-slot, 300 W, active | workstation/server с подходящим airflow; [NVIDIA datasheet](https://www.nvidia.com/content/dam/en-zz/Solutions/design-visualization/rtx-6000/proviz-rtx-6000-ada-datasheet-2616456-r5.pdf) |
| 3A | NVIDIA L40S | 48 ГБ GDDR6 ECC; 7–14B FP16, 32B INT4; 70B INT4 обычно требует 2x48 ГБ из-за weights+KV/runtime | PCIe Gen4 x16, dual-slot passive, 350 W; qualified 2U/4U only | локальная LLM; [NVIDIA L40S](https://www.nvidia.com/en-us/data-center/l40s/) |
| 3B | 2x L40S | 96 ГБ aggregate, но не единый VRAM pool; tensor/pipeline parallel и software support обязательны | 2x PCIe x16, 700 W GPU alone, 2x1400 W PSU class | 70B INT4, concurrency только по benchmark |
| consumer caveat | GeForce RTX 4090 | 24 ГБ GDDR6X, без enterprise ECC/support; 7–8B/часть 13B INT4 | 450 W, 3–4 slots, active open-air, 12VHPWR | лаборатория, не production; [NVIDIA specs](https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/) |

Приближённая память весов: `parameters × bytes/parameter`; FP16/BF16 = 2, INT8 ≈1,
INT4 ≈0,5 байта, затем минимум 15–30% runtime overhead плюс KV cache, растущий с context и
concurrent sequences. Поэтому 7B FP16 ≈14 ГБ до overhead, 32B INT4 ≈16 ГБ, 70B INT4 ≈35
ГБ, но это не гарантия размещения. Tokens/s и concurrency не придумываются: измеряются на
выбранной модели, quantization, context length и serving engine.

GPU CAPEX и российская цена не посчитаны: нет подтверждённого листинга и выбранной модели.
Break-even months = `GPU+host CAPEX / (cloud token cost per month - electricity - support)`;
нужны входы cloud ₽/1M input/output tokens, tokens/request, requests/month, measured kW,
тариф ₽/kWh и labour. Плата B650 имеет один основной x16 slot, поэтому multi-GPU требует
другой OEM chassis/platform; bifurcation, risers и peer-to-peer должны быть в OEM matrix.

## 9. Электроэнергия, OPEX и модернизация

Для сопоставимости `E = normal wall kW × 8 760 h`; инфраструктура: switch 60 W и backup 40
W. Денежный OPEX = `E × T + C_channel + C_offsite + C_support + C_UPS/years`, где `T` —
фактический тариф ₽/kWh. Тариф, канал, площадка и сервисные КП неизвестны, поэтому RUB/year
не выдумывается.

| Recommended | Воспроизводимая энергия | Годовой OPEX |
|---|---:|---|
| A: 1x`N16-128` | `(0,220+0,060+0,040)×8760 = 2 803 кВт·ч` | `2 803×T + channel + offsite + support + UPS amortization` |
| B: 2x`N16-128` | `(2×0,220+0,060+0,040)×8760 = 4 730 кВт·ч` | `4 730×T + channel + offsite + support + UPS amortization` |
| C: 3x`N16-128` | `(3×0,220+0,060+0,040)×8760 = 6 658 кВт·ч` | `6 658×T + channel + offsite + support + UPS amortization` |
| D: 2x`D32-512` target | `(2×0,600+0,120 switches+0,080 backup)×8760 = 12 264 кВт·ч` | **planning formula only**: `12 264×T + channel + offsite + OEM support + UPS amortization`; пересчитать после CTO/measurement |

OPEX каждой recommended-конфигурации включает замену батарей UPS, гарантию/support,
публичный канал и offsite storage; до КП эти слагаемые остаются именованными переменными.

Порядок развития без тупиков: (1) benchmark и мониторинг latency/CPU/RAM/SSD wear/free
space; (2) ещё два SSD на узел и RAID10, затем RAM с учётом замены всех DIMM; (3) API
replicas и DB pooling; (4) внешний witness или третий узел; (5) GPU только после отдельного
экономического и performance benchmark. Сразу фиксируются BMC, ECC, airflow, PSU headroom,
PCIe lanes, DIMM slots, hot-swap bays и 10GbE.

## 10. Финальная закупочная таблица

| Компонент | Минимальное требование | Рекомендуемая модель/класс | Количество | Допустимые аналоги | Обоснование |
|---|---|---|---:|---|---|
| CPU/platform | 12C/24T, ECC, BMC | EPYC 4564P + ASRock Rack B650D4U3-2L2Q | 2 | Xeon E-2400 только A; Dell/HPE OEM по matrix | 16C/node для 300–500 RPS совместно |
| RAM | 64 ГБ ECC UDIMM/node | 4x32 ГБ ECC DDR5 UDIMM из QVL/node | 8 DIMM | любой exact QVL P/N | 128 ГБ/node; ECC обязательна для DB |
| Data SSD | enterprise TLC, PLP, ≥1 DWPD | Samsung PM893 1,92 ТБ | 4 | нет заранее одобренных; аналог только после official datasheet по interface/PLP/endurance | RAID1/node; new drives |
| Chassis | mATX, airflow 170 W, 4 bays | 4U/tower, 8 hot-swap, supplier-qualified | 2 | OEM chassis с matrix | обслуживание и рост до RAID10 |
| PSU | 750 W, 80 Plus, EPS | 750 W либо redundant 2x800 W | 2 sets | OEM-qualified | peak и aging reserve |
| Network | 2x10GbE/node | onboard dual 10GbE | 2 sets | Intel X550-T2 | replication/backup separation |
| Switch | 8x10GbE, VLAN/LACP/SNMP | MikroTik CRS312 class | 1 | managed equivalent, qualified optics | минимум 2 spare ports |
| UPS | ≥1 800 W, monitoring | APC SMT2200IC class, 2200 VA/1980 W | 1 | Eaton 9SX class по runtime chart | shutdown при outage; не HA feed |
| Backup | off-node, encrypted, ≥8 ТБ usable | отдельное 8 ТБ usable/offsite | 1 | S3-compatible immutable target | RAID не backup; RPO зависит от runbook |
| GPU | не требуется | не закупать | 0 | L4/RTX 6000 Ada/L40S после benchmark | cloud LLM остаётся текущей схемой |

## 11. Закупочные стоп-условия

Закупка останавливается, если нет exact P/N/QVL/BIOS confirmation, SMART/endurance/PLP,
расчёта raw и usable, runtime UPS, гарантийного срока, НДС и наличия в КП. Также стоп:
benchmark не подтверждает требуемый режим; B-recommended выходит за 1 млн ₽ без согласованного
сокращения; площадка не обеспечивает питание/охлаждение/10GbE; backup/restore не проверен.
Ни RAID, ни dual PSU, ни UPS не заменяют второй узел и внешний backup.
