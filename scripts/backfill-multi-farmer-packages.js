/**
 * backfill-multi-farmer-packages.js
 *
 * 다중 생산자 배치의 포장 패키지(MillingOutputPackage)에
 * 생산자별 stockId를 배정하는 backfill 스크립트.
 *
 * 알고리즘:
 * 1. 해당 배치의 실제 수율 = 총 출력량 / 총 투입량
 * 2. 생산자별 예상 생산량 = 투입량 × 실제 수율 (합계 보정 포함)
 * 3. 투입량 내림차순으로 정렬된 생산자에게 큰 포장단위부터 순서대로 분배
 * 4. count 분리 허용 (총 count, 총 totalWeight는 배치 단위로 불변)
 *
 * 제외 배치: batch=103 (이미 올바르게 배정됨)
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 포장 단위 크기 순서 (큰 것부터)
const PKG_ORDER = ['톤백', '20kg', '10kg', '8kg', '5kg', '4kg', '3kg', '1kg', '잔량', '기타'];
function pkgRank(t) {
  const i = PKG_ORDER.indexOf(t);
  return i === -1 ? 99 : i;
}

// lotNo 생성
function generateLotNo({ incomingDate, varietyType, varietyName, millingType, certNo, farmerGroupCode, farmerNo }) {
  const yymmdd = new Date(incomingDate).toISOString().slice(2, 10).replace(/-/g, '');
  const productCode = getProductCode(varietyType, varietyName, millingType);
  const personalNo = `${farmerGroupCode}${farmerNo}`;
  return `${yymmdd}-${productCode}-${certNo}-${personalNo}`;
}

function getProductCode(varietyType, varietyName, millingType) {
  if (varietyName.includes('보리')) return varietyName.includes('검정') ? '215' : '21';
  if (varietyName.includes('통밀')) return '22';
  if (varietyName.includes('수수')) return '23';
  if (varietyName.includes('기장')) return '24';
  if (varietyName.includes('차조')) return '25';
  if (varietyName.includes('백태') || (varietyName.includes('콩') && !varietyName.includes('서리') && !varietyName.includes('쥐눈'))) return '26';
  if (varietyName.includes('귀리')) return '27';
  if (varietyName.includes('참깨')) return '28';
  if (varietyName.includes('아마란스')) return '29';
  if (varietyName.includes('율무')) return '210';
  if (varietyName.includes('녹두')) return '211';
  if (varietyName.includes('팥') || varietyName.includes('적두')) return '212';
  if (varietyName.includes('서목태') || varietyName.includes('쥐눈이')) return '213';
  if (varietyName.includes('서리태')) return '214';
  if (varietyType === 'BLACK' || varietyName.includes('흑미')) return '15';
  if (varietyName.includes('녹미')) return '16';
  if (varietyName.includes('홍미')) return '17';
  const isBrown = millingType.includes('현미');
  if (varietyType === 'URUCHI') return isBrown ? '13' : '11';
  if (varietyType === 'GLUTINOUS') return isBrown ? '14' : '12';
  if (varietyType === 'INDICA') return isBrown ? '19' : '18';
  return '00';
}

/**
 * stockId로부터 lotNo, productCode 생성에 필요한 정보 조회
 */
async function getLotInfoByStockId(stockId, millingType) {
  const stock = await prisma.stock.findUnique({
    where: { id: stockId },
    include: {
      variety: true,
      farmer: { include: { group: true } },
    },
  });
  if (!stock || !stock.farmer || !stock.farmer.group) return null;

  const lotNo = generateLotNo({
    incomingDate: stock.incomingDate,
    varietyType: stock.variety.type,
    varietyName: stock.variety.name,
    millingType,
    certNo: stock.farmer.group.certNo,
    farmerGroupCode: stock.farmer.group.code,
    farmerNo: stock.farmer.farmerNo ?? '',
  });
  const productCode = getProductCode(stock.variety.type, stock.variety.name, millingType);
  return { lotNo, productCode };
}

/**
 * 배치 하나에 대한 분배 계산
 * @returns { assignments: [{pkgId, count, totalWeight, stockId}], splits: [{originalPkgId, count, totalWeight, stockId}] }
 *   assignments: 기존 레코드 업데이트 목록 (pkgId 기준)
 *   splits: 새로 생성할 분리 레코드 목록
 */
function calcDistribution(batch) {
  const totalOutput = batch.outputs.reduce((s, o) => s + o.totalWeight, 0);
  const actualYield = totalOutput / batch.totalInputKg;

  // 생산자별 투입량 집계 (farmerId 기준)
  const farmerMap = {};
  for (const s of batch.stocks) {
    if (!farmerMap[s.farmerId]) {
      farmerMap[s.farmerId] = { name: s.farmer.name, kg: 0, stocks: [], remaining: 0 };
    }
    farmerMap[s.farmerId].kg += s.weightKg;
    farmerMap[s.farmerId].stocks.push(s.id);
  }

  // 투입량 내림차순 정렬 + 예상 생산량
  const farmers = Object.values(farmerMap)
    .map(f => ({ ...f, remaining: Math.round(f.kg * actualYield) }))
    .sort((a, b) => b.kg - a.kg);

  // 반올림 오차 보정 (마지막 생산자에게 나머지 배당)
  const totalExpected = farmers.reduce((s, f) => s + f.remaining, 0);
  farmers[farmers.length - 1].remaining += (Math.round(totalOutput) - totalExpected);

  // 포장 큰 단위부터 정렬
  const pkgs = [...batch.outputs].sort((a, b) => pkgRank(a.packageType) - pkgRank(b.packageType) || a.id - b.id);

  // 분배 계산
  // result: Map<pkgId, [{count, totalWeight, stockId}]>
  const result = new Map();
  let fi = 0;

  for (const pkg of pkgs) {
    let remainCount = pkg.count;
    let remainWeight = pkg.totalWeight;

    while (remainCount > 0) {
      // 남은 생산자가 없으면 마지막 생산자에게
      if (fi >= farmers.length) fi = farmers.length - 1;
      const f = farmers[fi];

      let allocCount, allocWeight;

      if (pkg.packageType === '잔량' || pkg.weightPerUnit === 0) {
        // 잔량: 통째로 배정
        allocCount = remainCount;
        allocWeight = remainWeight;
      } else {
        // 이 생산자 남은 예상량으로 받을 수 있는 최대 count
        const maxCount = Math.floor(f.remaining / pkg.weightPerUnit);

        if (maxCount <= 0) {
          // 이 생산자가 1개도 못 받으면 다음 생산자로
          if (fi < farmers.length - 1) { fi++; continue; }
          // 마지막 생산자면 남은 것 전부
          allocCount = remainCount;
          allocWeight = remainCount * pkg.weightPerUnit;
        } else {
          allocCount = Math.min(remainCount, maxCount);
          allocWeight = allocCount * pkg.weightPerUnit;
        }
      }

      if (!result.has(pkg.id)) result.set(pkg.id, []);
      result.get(pkg.id).push({ count: allocCount, totalWeight: allocWeight, stockId: f.stocks[0] });

      f.remaining -= allocWeight;
      remainCount -= allocCount;
      remainWeight -= allocWeight;

      // 이 생산자 몫이 다 찼으면 다음으로
      if (f.remaining <= 0 || (pkg.weightPerUnit > 0 && f.remaining < pkg.weightPerUnit && fi < farmers.length - 1)) {
        fi++;
      }
    }
  }

  // assignments(기존 레코드 수정) & splits(신규 레코드 생성) 분리
  const assignments = [];
  const splits = [];

  for (const [pkgId, parts] of result.entries()) {
    // 첫 번째 파트 → 기존 레코드 수정
    assignments.push({ pkgId, ...parts[0] });
    // 나머지 → 신규 생성
    for (let i = 1; i < parts.length; i++) {
      splits.push({ originalPkgId: pkgId, ...parts[i] });
    }
  }

  return { assignments, splits };
}

async function main() {
  console.log('=== Backfill 시작 ===\n');

  // 다중 생산자 배치 조회 (103 제외)
  const batches = await prisma.millingBatch.findMany({
    where: { id: { not: 103 } },
    include: {
      stocks: { include: { farmer: { include: { group: true } }, variety: true } },
      outputs: true,
    },
    orderBy: { date: 'asc' },
  });

  const multifarmer = batches.filter(b => {
    const ids = new Set(b.stocks.map(s => s.farmerId));
    return ids.size > 1 && b.outputs.length > 0;
  });

  console.log(`대상 배치: ${multifarmer.length}개\n`);

  // ===== 사전 검증 =====
  console.log('--- 사전 검증 (배치별 포장 합계) ---');
  const preSums = {};
  for (const b of multifarmer) {
    const totalCount = b.outputs.reduce((s, o) => s + o.count, 0);
    const totalWeight = b.outputs.reduce((s, o) => s + o.totalWeight, 0);
    preSums[b.id] = { totalCount, totalWeight };
    console.log(`  batch=${b.id}: count=${totalCount}, weight=${totalWeight}kg`);
  }

  // ===== 분배 계산 & DB 업데이트 =====
  console.log('\n--- 분배 실행 ---');

  for (const b of multifarmer) {
    const { assignments, splits } = calcDistribution(b);
    const totalOutput = b.outputs.reduce((s, o) => s + o.totalWeight, 0);
    const actualYield = (totalOutput / b.totalInputKg * 100).toFixed(1);

    console.log(`\nbatch=${b.id} | ${b.date.toISOString().slice(0, 10)} | ${b.millingType} | 실제수율=${actualYield}%`);

    // 트랜잭션 전에 모든 lotInfo 사전 조회
    const lotInfoCache = {};
    const allStockIds = [...new Set([
      ...assignments.map(a => a.stockId),
      ...splits.map(s => s.stockId),
    ])];
    for (const stockId of allStockIds) {
      lotInfoCache[stockId] = await getLotInfoByStockId(stockId, b.millingType);
    }

    await prisma.$transaction(async (tx) => {
      // 기존 레코드 업데이트
      for (const a of assignments) {
        const lotInfo = lotInfoCache[a.stockId];
        await tx.millingOutputPackage.update({
          where: { id: a.pkgId },
          data: {
            count: a.count,
            totalWeight: a.totalWeight,
            stockId: a.stockId,
            lotNo: lotInfo?.lotNo ?? null,
            productCode: lotInfo?.productCode ?? null,
          },
        });
        console.log(`  UPDATE pkg=${a.pkgId} → stock=${a.stockId}, count=${a.count}, weight=${a.totalWeight}kg`);
      }

      // 신규 레코드 생성 (원본 패키지에서 packageType, weightPerUnit, batchId 복사)
      for (const sp of splits) {
        const origPkg = b.outputs.find(o => o.id === sp.originalPkgId);
        const lotInfo = lotInfoCache[sp.stockId];
        const newPkg = await tx.millingOutputPackage.create({
          data: {
            batchId: b.id,
            packageType: origPkg.packageType,
            weightPerUnit: origPkg.weightPerUnit,
            count: sp.count,
            totalWeight: sp.totalWeight,
            stockId: sp.stockId,
            lotNo: lotInfo?.lotNo ?? null,
            productCode: lotInfo?.productCode ?? null,
          },
        });
        console.log(`  CREATE pkg=${newPkg.id} (원본=${sp.originalPkgId}) → stock=${sp.stockId}, count=${sp.count}, weight=${sp.totalWeight}kg`);
      }
    });
  }

  // ===== 사후 검증 =====
  console.log('\n--- 사후 검증 (배치별 포장 합계 비교) ---');
  let allOk = true;
  for (const b of multifarmer) {
    const afterPkgs = await prisma.millingOutputPackage.findMany({ where: { batchId: b.id } });
    const totalCount = afterPkgs.reduce((s, o) => s + o.count, 0);
    const totalWeight = afterPkgs.reduce((s, o) => s + o.totalWeight, 0);
    const pre = preSums[b.id];
    const countOk = totalCount === pre.totalCount;
    const weightOk = Math.abs(totalWeight - pre.totalWeight) < 0.01;
    const status = countOk && weightOk ? '✓ OK' : '✗ MISMATCH';
    if (!countOk || !weightOk) allOk = false;
    console.log(
      `  batch=${b.id}: count ${pre.totalCount}→${totalCount} ${countOk ? '✓' : '✗'} | ` +
      `weight ${pre.totalWeight}→${totalWeight}kg ${weightOk ? '✓' : '✗'} | ${status}`
    );
  }

  console.log(`\n=== 완료 ${allOk ? '✓ 모두 정상' : '✗ 불일치 있음 — 확인 필요'} ===`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
