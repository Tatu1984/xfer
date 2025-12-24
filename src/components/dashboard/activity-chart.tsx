"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer } from "recharts";

const chartData = [
  { date: "Jan 1", incoming: 2400, outgoing: 1398 },
  { date: "Jan 5", incoming: 1398, outgoing: 2210 },
  { date: "Jan 10", incoming: 9800, outgoing: 2290 },
  { date: "Jan 15", incoming: 3908, outgoing: 2000 },
  { date: "Jan 20", incoming: 4800, outgoing: 2181 },
  { date: "Jan 25", incoming: 3800, outgoing: 2500 },
  { date: "Jan 30", incoming: 4300, outgoing: 2100 },
];

const chartConfig: ChartConfig = {
  incoming: {
    label: "Incoming",
    color: "hsl(142, 76%, 36%)",
  },
  outgoing: {
    label: "Outgoing",
    color: "hsl(0, 84%, 60%)",
  },
};

export function ActivityChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Activity</CardTitle>
        <CardDescription>
          Your incoming and outgoing payments this month
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value / 1000}k`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="incoming"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorIncoming)"
              />
              <Area
                type="monotone"
                dataKey="outgoing"
                stroke="hsl(0, 84%, 60%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorOutgoing)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
