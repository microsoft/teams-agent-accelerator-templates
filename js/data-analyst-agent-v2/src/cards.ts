import {
  AdaptiveCard,
  VerticalBarChart,
  LineChart,
  HorizontalBarChart,
  PieChart,
  TextBlock
} from '@microsoft/teams.cards';
import { QueryResult } from './interfaces';

export function generateChartCard(
  queryResult: QueryResult,
  chartType: 'line' | 'verticalBar' | 'horizontalBar' | 'pie',
  options?: {
    title?: string;
    xAxisTitle?: string;
    yAxisTitle?: string;
    colorSet?: string;
    color?: string;
    showBarValues?: boolean;
  }
): AdaptiveCard {
  const card = new AdaptiveCard();
  card.version = '1.5';

  const {
    title = 'Chart',
    xAxisTitle = queryResult.columns[0],
    yAxisTitle = queryResult.columns[1],
    showBarValues
  } = options || {};

  let chart;
  if (chartType === 'verticalBar') {
    chart = new VerticalBarChart({
      title,
      xAxisTitle,
      yAxisTitle,
      showBarValues,
      data: queryResult.rows.map(row => ({
        x: row[0],
        y: row[1],
      }))
    });
  } else if (chartType === 'line') {
    chart = new LineChart({
      title,
      xAxisTitle,
      yAxisTitle,
      data: [
        {
          legend: title,
          values: queryResult.rows.map(row => ({
            x: row[0],
            y: row[1]
          })),
        }
      ]
    });
  } else if (chartType === 'horizontalBar') {
    chart = new HorizontalBarChart({
      title,
      xAxisTitle,
      yAxisTitle,
      data: queryResult.rows.map(row => ({
        x: String(row[0]), // ensure x is always a string
        y: row[1],
      }))
    });
  } else if (chartType === 'pie') {
    chart = new PieChart({
      title,
      data: queryResult.rows.map(row => ({
        legend: row[0],
        value: row[1],
      })),
      colorSet: "categorical"
    });
  } else {
    throw new Error('Unsupported chart type');
  }

  card.body.push(new TextBlock(title, { weight: 'Bolder', size: 'Medium' }));
  card.body.push(chart);
  return card;
}
