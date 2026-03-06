const ids = [
  "lower",
  "upper",
  "gridCount",
  "qtyPerGrid",
  "margin",
  "leverage",
  "stopLower",
  "stopUpper",
  "startPrice",
  "atr",
];

const fmtNum = (n, d = 2) => Number.isFinite(n) ? n.toLocaleString("zh-CN", { maximumFractionDigits: d, minimumFractionDigits: d }) : "-";
const fmtPct = (n) => Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : "-";

function parseInputs() {
  return ids.reduce((acc, id) => {
    const v = document.getElementById(id).value.trim();
    acc[id] = v === "" ? NaN : Number(v);
    return acc;
  }, {});
}

function clampFilledGrids(steps, gridCount) {
  if (!Number.isFinite(steps) || steps <= 0) return 0;
  return Math.max(0, Math.min(gridCount, Math.floor(steps)));
}

function calcSideLoss(startPrice, stopPrice, step, qtyPerGrid, gridCount, isDownward) {
  const crossed = isDownward ? (startPrice - stopPrice) / step : (stopPrice - startPrice) / step;
  const filled = clampFilledGrids(crossed, gridCount);
  if (filled === 0) return { loss: 0, filled, avgEntry: startPrice };

  const avgEntry = isDownward
    ? startPrice - (step * (filled + 1)) / 2
    : startPrice + (step * (filled + 1)) / 2;

  const positionQty = filled * qtyPerGrid;
  const loss = isDownward
    ? Math.max(0, positionQty * (avgEntry - stopPrice))
    : Math.max(0, positionQty * (stopPrice - avgEntry));

  return { loss, filled, avgEntry };
}

function riskLevel(lossRate) {
  if (lossRate < 0.1) return "低";
  if (lossRate < 0.25) return "中";
  if (lossRate < 0.4) return "高";
  return "极高";
}

function efficiencyGrade(dailyRate, maxLossRate) {
  if (dailyRate <= 0) return "D";
  const rr = dailyRate / Math.max(maxLossRate, 1e-9);
  if (rr >= 0.25) return "A";
  if (rr >= 0.15) return "B";
  if (rr >= 0.08) return "C";
  return "D";
}

function estimateDailyRounds(atr, step, gridCount) {
  if (!Number.isFinite(atr) || atr <= 0 || step <= 0) return 0;
  const raw = (atr / step) * 0.6;
  return Math.min(raw, gridCount * 1.5);
}

function calculate() {
  const i = parseInputs();
  const required = ["lower", "upper", "gridCount", "qtyPerGrid", "margin", "leverage", "stopLower", "stopUpper", "startPrice"];
  if (required.some((k) => !Number.isFinite(i[k])) || i.upper <= i.lower || i.gridCount <= 0 || i.startPrice <= 0 || i.margin <= 0 || i.qtyPerGrid <= 0) {
    return renderInvalid("请先输入有效参数（价格、网格数、数量、保证金均需为正数，且上沿 > 下沿）。");
  }

  const step = (i.upper - i.lower) / i.gridCount;
  if (step <= 0) return renderInvalid("网格步长无效。请检查上沿、下沿与网格数。");

  const down = calcSideLoss(i.startPrice, i.stopLower, step, i.qtyPerGrid, i.gridCount, true);
  const up = calcSideLoss(i.startPrice, i.stopUpper, step, i.qtyPerGrid, i.gridCount, false);
  const maxLoss = Math.max(down.loss, up.loss);

  const maxLossRate = maxLoss / i.margin;
  const rangeRatio = (i.upper - i.lower) / i.startPrice;

  const dailyRounds = estimateDailyRounds(i.atr, step, i.gridCount);
  const grossPerRound = i.qtyPerGrid * step;
  const feePerRound = i.qtyPerGrid * i.startPrice * 0.0008;
  const dailyNet = dailyRounds * (grossPerRound - feePerRound);
  const dailyRate = dailyNet / i.margin;

  document.getElementById("rangeRatio").textContent = fmtPct(rangeRatio);
  document.getElementById("maxLoss").textContent = `${fmtNum(maxLoss)} USDT`;
  document.getElementById("maxLossRate").textContent = fmtPct(maxLossRate);
  document.getElementById("riskLevel").textContent = riskLevel(maxLossRate);
  document.getElementById("dailyNet").textContent = `${fmtNum(dailyNet)} USDT`;
  document.getElementById("dailyRate").textContent = fmtPct(dailyRate);
  document.getElementById("efficiency").textContent = efficiencyGrade(dailyRate, maxLossRate);

  document.getElementById("detail").textContent =
    `向下止损估算亏损 ${fmtNum(down.loss)} USDT（触发约 ${down.filled} 格）；` +
    `向上止损估算亏损 ${fmtNum(up.loss)} USDT（触发约 ${up.filled} 格）。` +
    `最大亏损取两者较大值。ATR 仅用于估算日内有效成交次数，杠杆 ${i.leverage}x 已由你在保证金规划中体现。`;
}

function renderInvalid(text) {
  ["rangeRatio", "maxLoss", "maxLossRate", "riskLevel", "dailyNet", "dailyRate", "efficiency"].forEach((id) => {
    document.getElementById(id).textContent = "-";
  });
  document.getElementById("detail").textContent = text;
}

ids.forEach((id) => {
  document.getElementById(id).addEventListener("input", calculate);
});

calculate();
