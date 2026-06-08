export function formatCurrency(value: number) {
  return `K${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Math.floor(value));
}

export function widthClass(percent: number) {
  if (percent >= 95) return "w-full";
  if (percent >= 90) return "w-[90%]";
  if (percent >= 80) return "w-[80%]";
  if (percent >= 70) return "w-[70%]";
  if (percent >= 60) return "w-[60%]";
  if (percent >= 50) return "w-1/2";
  if (percent >= 40) return "w-[40%]";
  if (percent >= 30) return "w-[30%]";
  if (percent >= 20) return "w-[20%]";
  if (percent >= 10) return "w-[10%]";
  if (percent > 0) return "w-[5%]";
  return "w-0";
}
