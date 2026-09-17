# Synthetic dataset and measurement provenance

Every record is deterministic teaching data. Names, `.test` email addresses, product records, orders and dates are invented; none comes from a private application or customer database. Money values are integer USD cents. The dataset is not a sales-performance claim.

| Table       | Rows | Columns                                                                              |
| ----------- | ---: | ------------------------------------------------------------------------------------ |
| customers   |   12 | id INTEGER PK; name TEXT; city TEXT; nullable email TEXT                             |
| products    |    8 | id INTEGER PK; name TEXT; category TEXT; price_cents INTEGER                         |
| orders      |   72 | id INTEGER PK; customer_id INTEGER FK; ordered_at ISO date TEXT; status TEXT         |
| order_items |  144 | order_id/product_id composite PK and FKs; quantity INTEGER; unit_price_cents INTEGER |

The schema explorer uses trusted `PRAGMA table_info` and actual `COUNT(*)` results during initialization. Arbitrary user PRAGMA queries remain blocked. Dates run from 2026-01-01 through 2026-03-13. Eight orders are cancelled and 64 completed. Revenue examples exclude cancelled orders; quantities/prices come from the order line, not a silently recomputed current product price.

## Deterministic generation

For zero-based order index `i=0..71`, order ID is `i+1`, customer ID is `(i mod 12)+1`, date is January 1 plus i days, and orders where `i mod 9=0` are cancelled. Each order has two distinct products: zero-based product indices `(3i mod 8)` and `(3i+3 mod 8)`, with quantities `(i mod 3)+1` and `(i mod 2)+1`. Line price copies the product's listed cents at seed time. Products and customers are explicit records in `src/domain/dataset.ts`.

## Independent expected totals

The implementation's SQL results were checked against separately calculated arithmetic using the generator formula and product price list; expected results are hardcoded in integration tests rather than obtained from the query under test.

| Completed category | Revenue cents | Units |
| ------------------ | ------------: | ----: |
| Workspace          |        365100 |    83 |
| Everyday carry     |        249200 |    83 |
| Stationery         |        112200 |    66 |
| Total              |        726500 |   232 |

| City      | Completed orders | Revenue cents |
| --------- | ---------------: | ------------: |
| Taichung  |               16 |        242500 |
| Tainan    |               16 |        200000 |
| Taipei    |               16 |        152000 |
| Kaohsiung |               16 |        132000 |

Monthly completed revenue is 303400 cents in January, 283100 in February and 140000 in March. Order 2 belongs to Sam Lin on 2026-01-02: two Desk lights at 6900 cents (13800 line total) and two Weekly planners at 1600 cents (3200 line total). Customer IDs 4, 6 and 10 have NULL emails. These independent examples exercise joins, distinct order counts, ISO grouping and SQL null semantics.

The database is regenerated after cancel/timeout/retry. No SQL change persists across worker replacement or page reload. No external database/file import is implemented.
