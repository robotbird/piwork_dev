// ECharts 画布无法读取 CSS 变量，图表配色集中在此单一来源，
// 与 globals.css 的 --chart-* / .dark 覆盖保持同步。
export type ChartTheme = {
  axisLabel: string;
  axisLine: string;
  donutCaption: string;
  donutCenter: string;
  neutralSeries: string;
  other: string;
  palette: string[];
  splitLine: string;
  tooltipBackground: string;
  tooltipText: string;
};

export const CHART_PALETTE = {
  dark: ["#3291ff", "#4ddecf", "#9d7bff", "#ffd76a", "#ff5ca8"],
  light: ["#007cf0", "#00dfd8", "#7928ca", "#f9cb28", "#eb367f"],
} as const;

export function getChartTheme(mode: "dark" | "light"): ChartTheme {
  if (mode === "dark") {
    return {
      axisLabel: "#6e6e6e",
      axisLine: "#262626",
      donutCaption: "#6e6e6e",
      donutCenter: "#ededed",
      neutralSeries: "#262626",
      other: "#575757",
      palette: [...CHART_PALETTE.dark],
      splitLine: "#1f1f1f",
      tooltipBackground: "#171717",
      tooltipText: "#ffffff",
    };
  }
  return {
    axisLabel: "#8f8f8f",
    axisLine: "#ebebeb",
    donutCaption: "#8f8f8f",
    donutCenter: "#171717",
    neutralSeries: "#ebebeb",
    other: "#a1a1a1",
    palette: [...CHART_PALETTE.light],
    splitLine: "#f2f2f2",
    tooltipBackground: "#171717",
    tooltipText: "#ffffff",
  };
}
